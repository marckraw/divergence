use super::provider_registry::{apply_binary_dir_to_tokio_command, detect_opencode_binary};
use super::{
    AgentActivityStatus, AgentInteractionMode, AgentMessageStatus, AgentRequest,
    AgentRequestKind, AgentRequestOption, AgentRequestStatus, AgentRuntimeState,
    AgentRuntimeStatus, AgentSessionSnapshot, AgentSessionStatus, AgentTurnInvocation,
    PendingRequestTransport, RunningSessionHandle, RunningTransport, DEFAULT_OPENCODE_MODEL,
    append_assistant_text, complete_activity, create_activity, ensure_assistant_message,
    last_assistant_message_mut, now_ms, push_runtime_event, refresh_activity_metadata,
    truncate_details, truncate_json_details,
};
use reqwest::{Client, Response, StatusCode};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::net::TcpListener;
use std::path::Path;
use std::process::Stdio;
use std::sync::Arc;
use tauri::AppHandle;
use tokio::io::AsyncReadExt;
use tokio::process::Command;
use tokio::sync::Mutex as AsyncMutex;
use tokio::time::Duration;
use uuid::Uuid;

#[derive(Default)]
struct OpenCodeStreamState {
    text_part_lengths: HashMap<String, usize>,
    reasoning_part_lengths: HashMap<String, usize>,
}

struct OpenCodeEventContext<'a> {
    app: &'a AppHandle,
    session_id: &'a str,
    opencode_session_id: &'a str,
    base_url: &'a str,
    directory: &'a str,
}

impl AgentRuntimeState {
    pub(super) async fn run_opencode_turn_process(
        &self,
        app: &AppHandle,
        session: &AgentSessionSnapshot,
        session_id: &str,
        turn: &AgentTurnInvocation,
    ) -> Result<(), String> {
        self.emit_runtime_event(
            app,
            session_id,
            "Launching provider",
            "Starting OpenCode server.",
            Some(session.model.clone()),
        )?;
        if !Path::new(&session.path).is_dir() {
            return Err(format!(
                "Cannot start OpenCode because the workspace path does not exist: {}",
                session.path
            ));
        }

        let binary = detect_opencode_binary().ok_or_else(|| {
            "OpenCode CLI was not found. Install OpenCode and configure at least one provider before starting an OpenCode session.".to_string()
        })?;
        let port = reserve_loopback_port()?;
        let base_url = format!("http://127.0.0.1:{port}");

        let mut command = Command::new(&binary);
        apply_binary_dir_to_tokio_command(&mut command, &binary);
        command
            .arg("serve")
            .arg("--hostname")
            .arg("127.0.0.1")
            .arg("--port")
            .arg(port.to_string())
            .current_dir(&session.path)
            .stdout(Stdio::null())
            .stderr(Stdio::piped())
            .env("OPENCODE_CLIENT", "divergence")
            .env("OPENCODE_EXPERIMENTAL_PLAN_MODE", "true");

        if turn.automation_mode {
            command.env("OPENCODE_PERMISSION", r#"{"*":"allow"}"#);
        }

        let mut child = command
            .spawn()
            .map_err(|error| format!("Failed to spawn OpenCode server: {error}"))?;
        let stderr = child
            .stderr
            .take()
            .ok_or_else(|| "OpenCode stderr stream was not available.".to_string())?;

        let child = Arc::new(AsyncMutex::new(child));
        self.register_running_session(
            session_id,
            RunningSessionHandle {
                child: child.clone(),
                transport: RunningTransport::OpenCodeServer,
            },
        )?;

        let stderr_task = tokio::spawn(async move {
            let mut buffer = Vec::new();
            let mut reader = stderr;
            let _ = reader.read_to_end(&mut buffer).await;
            String::from_utf8_lossy(&buffer).to_string()
        });

        let client = Client::new();
        let server_version = match wait_for_opencode_server_ready(&client, &base_url).await {
            Ok(version) => version,
            Err(error) => {
                self.mark_session_stopping(session_id);
                {
                    let mut running_child = child.lock().await;
                    let _ = running_child.kill().await;
                }
                let stderr_output = stderr_task.await.map_err(|join_error| {
                    format!("Failed collecting OpenCode stderr: {join_error}")
                })?;
                return Err(append_stderr_to_error(error, &stderr_output));
            }
        };

        self.emit_runtime_event(
            app,
            session_id,
            "Initializing provider",
            "OpenCode server is ready.",
            server_version,
        )?;

        let mut event_response =
            match open_opencode_event_stream(&client, &base_url, &session.path).await {
                Ok(response) => response,
                Err(error) => {
                    self.mark_session_stopping(session_id);
                    {
                        let mut running_child = child.lock().await;
                        let _ = running_child.kill().await;
                    }
                    let stderr_output = stderr_task.await.map_err(|join_error| {
                        format!("Failed collecting OpenCode stderr: {join_error}")
                    })?;
                    return Err(append_stderr_to_error(error, &stderr_output));
                }
            };

        let opencode_session_id = match self
            .prepare_opencode_session(app, session_id, session, &client, &base_url)
            .await
        {
            Ok(opencode_session_id) => opencode_session_id,
            Err(error) => {
                self.mark_session_stopping(session_id);
                {
                    let mut running_child = child.lock().await;
                    let _ = running_child.kill().await;
                }
                let stderr_output = stderr_task.await.map_err(|join_error| {
                    format!("Failed collecting OpenCode stderr: {join_error}")
                })?;
                return Err(append_stderr_to_error(error, &stderr_output));
            }
        };

        if let Err(error) = send_opencode_prompt(
            &client,
            &base_url,
            &session.path,
            &opencode_session_id,
            session,
            turn,
        )
        .await
        {
            self.mark_session_stopping(session_id);
            {
                let mut running_child = child.lock().await;
                let _ = running_child.kill().await;
            }
            let stderr_output = stderr_task
                .await
                .map_err(|join_error| format!("Failed collecting OpenCode stderr: {join_error}"))?;
            return Err(append_stderr_to_error(error, &stderr_output));
        }

        self.emit_runtime_event(
            app,
            session_id,
            "Waiting for model",
            "OpenCode accepted the turn and is streaming session events.",
            None,
        )?;

        let event_context = OpenCodeEventContext {
            app,
            session_id,
            opencode_session_id: &opencode_session_id,
            base_url: &base_url,
            directory: &session.path,
        };
        let mut stream_state = OpenCodeStreamState::default();
        let turn_result = self
            .consume_opencode_events(&event_context, &mut event_response, &mut stream_state)
            .await;

        let was_stopping = self.is_session_stopping(session_id);
        self.mark_session_stopping(session_id);
        {
            let mut running_child = child.lock().await;
            let _ = running_child.kill().await;
        }

        let stderr_output = stderr_task
            .await
            .map_err(|error| format!("Failed collecting OpenCode stderr: {error}"))?;

        if was_stopping {
            return Ok(());
        }

        if turn_result.is_err() {
            return Err(append_stderr_to_error(
                turn_result
                    .err()
                    .unwrap_or_else(|| "OpenCode turn failed.".to_string()),
                &stderr_output,
            ));
        }

        if !stderr_output.trim().is_empty() {
            let snapshot = self.mutate_session(session_id, |current_session| {
                push_runtime_event(
                    current_session,
                    "Provider log",
                    "OpenCode emitted provider logs while completing the turn.",
                    Some(truncate_details(&stderr_output)),
                );
                current_session.updated_at_ms = now_ms();
                Ok(())
            })?;
            self.emit_snapshot_update(app, &snapshot);
        }

        Ok(())
    }

    async fn prepare_opencode_session(
        &self,
        app: &AppHandle,
        session_id: &str,
        session: &AgentSessionSnapshot,
        client: &Client,
        base_url: &str,
    ) -> Result<String, String> {
        if let Some(existing_session_id) = session.thread_id.as_deref() {
            if opencode_session_exists(client, base_url, &session.path, existing_session_id).await?
            {
                self.emit_runtime_event(
                    app,
                    session_id,
                    "Preparing thread",
                    "Resuming existing OpenCode session.",
                    Some(existing_session_id.to_string()),
                )?;
                return Ok(existing_session_id.to_string());
            }
        }

        self.emit_runtime_event(
            app,
            session_id,
            "Preparing thread",
            "Creating a new OpenCode session.",
            None,
        )?;

        let response = client
            .post(format!("{base_url}/session"))
            .query(&[("directory", session.path.as_str())])
            .json(&json!({
                "title": session.name,
            }))
            .send()
            .await
            .map_err(|error| format!("Failed to create OpenCode session: {error}"))?;

        if !response.status().is_success() {
            let status = response.status();
            let details = read_response_error_body(response).await;
            return Err(format!(
                "OpenCode session creation failed with status {status}: {details}"
            ));
        }

        let payload = response.json::<Value>().await.map_err(|error| {
            format!("Failed to decode OpenCode session creation response: {error}")
        })?;
        let created_session_id = read_opencode_session_id(&payload).ok_or_else(|| {
            "OpenCode session creation response did not include a session id.".to_string()
        })?;

        let snapshot = self.mutate_session(session_id, |current_session| {
            current_session.thread_id = Some(created_session_id.clone());
            push_runtime_event(
                current_session,
                "Preparing turn",
                "OpenCode session is ready.",
                Some(created_session_id.clone()),
            );
            current_session.updated_at_ms = now_ms();
            Ok(())
        })?;
        self.emit_snapshot_update(app, &snapshot);

        Ok(created_session_id)
    }

    async fn consume_opencode_events(
        &self,
        context: &OpenCodeEventContext<'_>,
        response: &mut Response,
        stream_state: &mut OpenCodeStreamState,
    ) -> Result<(), String> {
        let session_id = context.session_id;
        let mut sse_buffer = String::new();
        let mut event_data_lines: Vec<String> = Vec::new();

        while let Some(chunk) = response
            .chunk()
            .await
            .map_err(|error| format!("Failed reading OpenCode event stream: {error}"))?
        {
            if self.is_session_stopping(session_id) {
                return Ok(());
            }

            sse_buffer.push_str(&String::from_utf8_lossy(&chunk));
            while let Some(newline_index) = sse_buffer.find('\n') {
                let mut line = sse_buffer[..newline_index].to_string();
                sse_buffer = sse_buffer[newline_index + 1..].to_string();
                if line.ends_with('\r') {
                    line.pop();
                }

                if line.is_empty() {
                    if event_data_lines.is_empty() {
                        continue;
                    }

                    let payload = event_data_lines.join("\n");
                    event_data_lines.clear();
                    let parsed = match serde_json::from_str::<Value>(&payload) {
                        Ok(parsed) => parsed,
                        Err(_) => continue,
                    };

                    if let Some(completion) =
                        self.handle_opencode_event(context, parsed, stream_state)?
                    {
                        return completion;
                    }

                    continue;
                }

                if let Some(rest) = line.strip_prefix("data:") {
                    event_data_lines.push(rest.trim_start().to_string());
                }
            }
        }

        if self.is_session_stopping(session_id) {
            return Ok(());
        }

        Err("OpenCode event stream closed before the turn completed.".to_string())
    }

    fn handle_opencode_event(
        &self,
        context: &OpenCodeEventContext<'_>,
        parsed: Value,
        stream_state: &mut OpenCodeStreamState,
    ) -> Result<Option<Result<(), String>>, String> {
        let app = context.app;
        let session_id = context.session_id;
        let opencode_session_id = context.opencode_session_id;
        let base_url = context.base_url;
        let directory = context.directory;
        let event = parsed.get("payload").cloned().unwrap_or(parsed);
        let event_type = event
            .get("type")
            .and_then(Value::as_str)
            .unwrap_or_default();

        match event_type {
            "server.connected" => {
                let snapshot = self.mutate_session(session_id, |current_session| {
                    push_runtime_event(
                        current_session,
                        "Initializing provider",
                        "Connected to the OpenCode event stream.",
                        None,
                    );
                    current_session.updated_at_ms = now_ms();
                    Ok(())
                })?;
                self.emit_snapshot_update(app, &snapshot);
            }
            "message.updated" => {
                let info = event
                    .get("properties")
                    .and_then(|properties| properties.get("info"))
                    .cloned()
                    .unwrap_or(Value::Null);
                if info
                    .get("sessionID")
                    .and_then(Value::as_str)
                    .is_some_and(|candidate| candidate != opencode_session_id)
                {
                    return Ok(None);
                }
                if info.get("role").and_then(Value::as_str) != Some("assistant") {
                    return Ok(None);
                }
                let item_id = info.get("id").and_then(Value::as_str).map(str::to_string);
                let error_message = info.get("error").map(read_opencode_error_message);
                let completed_at_ms = info
                    .get("time")
                    .and_then(|time| time.get("completed"))
                    .and_then(Value::as_i64);
                let snapshot = self.mutate_session(session_id, |current_session| {
                    let message = ensure_assistant_message(current_session, item_id.as_deref());
                    message.status = if error_message.is_some() {
                        AgentMessageStatus::Error
                    } else if completed_at_ms.is_some() {
                        AgentMessageStatus::Done
                    } else {
                        AgentMessageStatus::Streaming
                    };
                    if message.content.trim().is_empty() && error_message.is_some() {
                        message.content = error_message.clone().unwrap_or_default();
                    }
                    push_runtime_event(
                        current_session,
                        if error_message.is_some() {
                            "Response errored"
                        } else {
                            "Streaming response"
                        },
                        "OpenCode updated an assistant message.",
                        error_message.clone(),
                    );
                    current_session.updated_at_ms = now_ms();
                    Ok(())
                })?;
                self.emit_snapshot_update(app, &snapshot);
            }
            "message.part.updated" => {
                let properties = event.get("properties").cloned().unwrap_or(Value::Null);
                let part = properties.get("part").cloned().unwrap_or(Value::Null);
                if part
                    .get("sessionID")
                    .and_then(Value::as_str)
                    .is_some_and(|candidate| candidate != opencode_session_id)
                {
                    return Ok(None);
                }
                self.handle_opencode_message_part(app, session_id, properties, part, stream_state)?;
            }
            "permission.updated" => {
                let permission = event.get("properties").cloned().unwrap_or(Value::Null);
                if permission
                    .get("sessionID")
                    .and_then(Value::as_str)
                    .is_some_and(|candidate| candidate != opencode_session_id)
                {
                    return Ok(None);
                }

                let (options, decisions) = default_opencode_permission_decisions();
                let Some(permission_id) = permission
                    .get("id")
                    .and_then(Value::as_str)
                    .filter(|value| !value.trim().is_empty())
                else {
                    return Ok(None);
                };
                let request_id = format!("request-{}", Uuid::new_v4());
                self.open_pending_request(
                    app,
                    session_id,
                    AgentRequest {
                        id: request_id.clone(),
                        kind: AgentRequestKind::Approval,
                        title: permission
                            .get("title")
                            .and_then(Value::as_str)
                            .filter(|value| !value.trim().is_empty())
                            .unwrap_or("OpenCode permission request")
                            .to_string(),
                        description: build_opencode_permission_description(&permission),
                        options: Some(options),
                        questions: None,
                        status: AgentRequestStatus::Open,
                        opened_at_ms: permission
                            .get("time")
                            .and_then(|time| time.get("created"))
                            .and_then(Value::as_i64)
                            .unwrap_or_else(now_ms),
                        resolved_at_ms: None,
                    },
                )?;
                self.store_pending_request_transport(
                    &request_id,
                    PendingRequestTransport::OpenCodePermission {
                        session_id: session_id.to_string(),
                        opencode_session_id: opencode_session_id.to_string(),
                        permission_id: permission_id.to_string(),
                        directory: directory.to_string(),
                        base_url: base_url.to_string(),
                        decisions,
                    },
                )?;
            }
            "permission.replied" => {
                let properties = event.get("properties").cloned().unwrap_or(Value::Null);
                if properties
                    .get("sessionID")
                    .and_then(Value::as_str)
                    .is_some_and(|candidate| candidate != opencode_session_id)
                {
                    return Ok(None);
                }
                let snapshot = self.mutate_session(session_id, |current_session| {
                    push_runtime_event(
                        current_session,
                        "Resumed turn",
                        "OpenCode permission request was answered.",
                        properties
                            .get("response")
                            .and_then(Value::as_str)
                            .map(str::to_string),
                    );
                    current_session.updated_at_ms = now_ms();
                    Ok(())
                })?;
                self.emit_snapshot_update(app, &snapshot);
            }
            "session.status" => {
                let properties = event.get("properties").cloned().unwrap_or(Value::Null);
                if properties
                    .get("sessionID")
                    .and_then(Value::as_str)
                    .is_some_and(|candidate| candidate != opencode_session_id)
                {
                    return Ok(None);
                }
                let status = properties.get("status").cloned().unwrap_or(Value::Null);
                let status_type = status
                    .get("type")
                    .and_then(Value::as_str)
                    .unwrap_or_default();
                let snapshot = self.mutate_session(session_id, |current_session| {
                    match status_type {
                        "busy" => {
                            current_session.runtime_status =
                                if current_session.pending_request.is_some() {
                                    AgentRuntimeStatus::Waiting
                                } else {
                                    AgentRuntimeStatus::Running
                                };
                            push_runtime_event(
                                current_session,
                                "Waiting for model",
                                "OpenCode is processing the current turn.",
                                None,
                            );
                        }
                        "retry" => {
                            let message = status
                                .get("message")
                                .and_then(Value::as_str)
                                .unwrap_or("OpenCode is retrying the request.");
                            let next_seconds = status
                                .get("next")
                                .and_then(Value::as_i64)
                                .map(|value| format!("{value}ms"));
                            push_runtime_event(current_session, "Retrying", message, next_seconds);
                        }
                        "idle" => {
                            push_runtime_event(
                                current_session,
                                "Waiting for completion",
                                "OpenCode reported the session as idle.",
                                None,
                            );
                        }
                        _ => {}
                    }
                    current_session.updated_at_ms = now_ms();
                    Ok(())
                })?;
                self.emit_snapshot_update(app, &snapshot);
            }
            "session.idle" => {
                let properties = event.get("properties").cloned().unwrap_or(Value::Null);
                if properties
                    .get("sessionID")
                    .and_then(Value::as_str)
                    .is_some_and(|candidate| candidate != opencode_session_id)
                {
                    return Ok(None);
                }
                let snapshot = self.mutate_session(session_id, |current_session| {
                    let has_error = current_session.error_message.is_some();
                    let error_message = current_session.error_message.clone();
                    if let Some(message) = last_assistant_message_mut(current_session) {
                        if matches!(message.status, AgentMessageStatus::Streaming) {
                            message.status = if has_error {
                                AgentMessageStatus::Error
                            } else {
                                AgentMessageStatus::Done
                            };
                        }
                    }
                    current_session.pending_request = None;
                    if has_error {
                        current_session.status = AgentSessionStatus::Idle;
                        current_session.runtime_status = AgentRuntimeStatus::Error;
                        push_runtime_event(
                            current_session,
                            "Turn failed",
                            "OpenCode finished the turn with an error.",
                            error_message,
                        );
                    } else {
                        current_session.status = AgentSessionStatus::Active;
                        current_session.runtime_status = AgentRuntimeStatus::Idle;
                        push_runtime_event(
                            current_session,
                            "Completed",
                            "OpenCode completed the turn.",
                            None,
                        );
                    }
                    current_session.updated_at_ms = now_ms();
                    Ok(())
                })?;
                self.emit_snapshot_update(app, &snapshot);
                return Ok(Some(snapshot.error_message.clone().map_or(Ok(()), Err)));
            }
            "session.error" => {
                let properties = event.get("properties").cloned().unwrap_or(Value::Null);
                let error_message = properties
                    .get("error")
                    .map(read_opencode_error_message)
                    .unwrap_or_else(|| "OpenCode session failed.".to_string());
                let snapshot = self.mutate_session(session_id, |current_session| {
                    current_session.status = AgentSessionStatus::Idle;
                    current_session.runtime_status = AgentRuntimeStatus::Error;
                    current_session.error_message = Some(error_message.clone());
                    push_runtime_event(
                        current_session,
                        "Errored",
                        "OpenCode emitted a session error.",
                        Some(error_message.clone()),
                    );
                    current_session.updated_at_ms = now_ms();
                    Ok(())
                })?;
                self.emit_snapshot_update(app, &snapshot);
                return Ok(Some(Err(error_message)));
            }
            "session.diff" => {
                let properties = event.get("properties").cloned().unwrap_or(Value::Null);
                if properties
                    .get("sessionID")
                    .and_then(Value::as_str)
                    .is_some_and(|candidate| candidate != opencode_session_id)
                {
                    return Ok(None);
                }
                let diff_count = properties
                    .get("diff")
                    .and_then(Value::as_array)
                    .map(|items| items.len())
                    .unwrap_or_default();
                let snapshot = self.mutate_session(session_id, |current_session| {
                    push_runtime_event(
                        current_session,
                        "Applied changes",
                        "OpenCode reported file diffs for the current session.",
                        Some(format!("{diff_count} changed file(s)")),
                    );
                    current_session.updated_at_ms = now_ms();
                    Ok(())
                })?;
                self.emit_snapshot_update(app, &snapshot);
            }
            "todo.updated" => {
                let properties = event.get("properties").cloned().unwrap_or(Value::Null);
                if properties
                    .get("sessionID")
                    .and_then(Value::as_str)
                    .is_some_and(|candidate| candidate != opencode_session_id)
                {
                    return Ok(None);
                }
                let todos = properties
                    .get("todos")
                    .and_then(Value::as_array)
                    .map(|items| items.len())
                    .unwrap_or_default();
                let snapshot = self.mutate_session(session_id, |current_session| {
                    push_runtime_event(
                        current_session,
                        "Todo updated",
                        "OpenCode updated the session todo list.",
                        Some(format!("{todos} todo item(s)")),
                    );
                    current_session.updated_at_ms = now_ms();
                    Ok(())
                })?;
                self.emit_snapshot_update(app, &snapshot);
            }
            _ => {}
        }

        Ok(None)
    }

    fn handle_opencode_message_part(
        &self,
        app: &AppHandle,
        session_id: &str,
        properties: Value,
        part: Value,
        stream_state: &mut OpenCodeStreamState,
    ) -> Result<(), String> {
        let part_type = part.get("type").and_then(Value::as_str).unwrap_or_default();
        match part_type {
            "text" => {
                if part
                    .get("ignored")
                    .and_then(Value::as_bool)
                    .unwrap_or(false)
                {
                    return Ok(());
                }
                let part_id = part.get("id").and_then(Value::as_str).unwrap_or_default();
                let full_text = part.get("text").and_then(Value::as_str).unwrap_or_default();
                let explicit_delta = properties.get("delta").and_then(Value::as_str);
                let delta = compute_opencode_part_delta(
                    &mut stream_state.text_part_lengths,
                    part_id,
                    full_text,
                    explicit_delta,
                );
                if delta.is_empty() {
                    return Ok(());
                }
                let item_id = part.get("messageID").and_then(Value::as_str);
                let snapshot = self.mutate_session(session_id, |current_session| {
                    append_assistant_text(current_session, item_id, &delta);
                    push_runtime_event(
                        current_session,
                        "Streaming response",
                        "Received OpenCode response text.",
                        None,
                    );
                    current_session.updated_at_ms = now_ms();
                    Ok(())
                })?;
                self.emit_snapshot_update(app, &snapshot);
            }
            "reasoning" => {
                let part_id = part.get("id").and_then(Value::as_str).unwrap_or_default();
                let full_text = part.get("text").and_then(Value::as_str).unwrap_or_default();
                let explicit_delta = properties.get("delta").and_then(Value::as_str);
                let delta = compute_opencode_part_delta(
                    &mut stream_state.reasoning_part_lengths,
                    part_id,
                    full_text,
                    explicit_delta,
                );
                let is_completed = part
                    .get("time")
                    .and_then(|time| time.get("end"))
                    .and_then(Value::as_i64)
                    .is_some();
                let snapshot = self.mutate_session(session_id, |current_session| {
                    if let Some(existing) = current_session
                        .activities
                        .iter_mut()
                        .find(|activity| activity.id == part_id)
                    {
                        if !delta.is_empty() {
                            let next_details = match existing.details.as_deref() {
                                Some(previous) if !previous.is_empty() => {
                                    format!("{previous}{delta}")
                                }
                                _ => delta.clone(),
                            };
                            existing.details = Some(truncate_details(&next_details));
                        }
                        existing.status = if is_completed {
                            AgentActivityStatus::Completed
                        } else {
                            AgentActivityStatus::Running
                        };
                        if is_completed {
                            existing.completed_at_ms = Some(now_ms());
                        }
                    } else {
                        current_session.activities.push(create_activity(
                            part_id.to_string(),
                            "thought_process".to_string(),
                            "Thinking".to_string(),
                            if is_completed {
                                AgentActivityStatus::Completed
                            } else {
                                AgentActivityStatus::Running
                            },
                            (!full_text.trim().is_empty()).then(|| truncate_details(full_text)),
                            part.get("time")
                                .and_then(|time| time.get("start"))
                                .and_then(Value::as_i64)
                                .unwrap_or_else(now_ms),
                            is_completed.then(now_ms),
                        ));
                    }
                    push_runtime_event(
                        current_session,
                        "Thinking",
                        "OpenCode emitted reasoning output.",
                        None,
                    );
                    current_session.updated_at_ms = now_ms();
                    Ok(())
                })?;
                self.emit_snapshot_update(app, &snapshot);
            }
            "tool" => {
                let activity_id = part
                    .get("callID")
                    .and_then(Value::as_str)
                    .or_else(|| part.get("id").and_then(Value::as_str))
                    .unwrap_or_default()
                    .to_string();
                if activity_id.is_empty() {
                    return Ok(());
                }
                let tool_name = part
                    .get("tool")
                    .and_then(Value::as_str)
                    .unwrap_or("tool")
                    .to_string();
                let state = part.get("state").cloned().unwrap_or(Value::Null);
                let state_status = state
                    .get("status")
                    .and_then(Value::as_str)
                    .unwrap_or("pending");
                let details = build_opencode_tool_details(&state);
                let snapshot = self.mutate_session(session_id, |current_session| {
                    match state_status {
                        "completed" => {
                            complete_activity(
                                current_session,
                                &activity_id,
                                details.clone(),
                                AgentActivityStatus::Completed,
                            );
                        }
                        "error" => {
                            complete_activity(
                                current_session,
                                &activity_id,
                                details.clone(),
                                AgentActivityStatus::Error,
                            );
                        }
                        _ => {
                            if let Some(existing) = current_session
                                .activities
                                .iter_mut()
                                .find(|activity| activity.id == activity_id)
                            {
                                existing.status = AgentActivityStatus::Running;
                                if let Some(next_details) = details.clone() {
                                    existing.details = Some(next_details);
                                }
                            } else {
                                current_session.activities.push(create_activity(
                                    activity_id.clone(),
                                    "tool".to_string(),
                                    tool_name.clone(),
                                    AgentActivityStatus::Running,
                                    details.clone(),
                                    read_opencode_tool_started_at(&state).unwrap_or_else(now_ms),
                                    None,
                                ));
                            }
                        }
                    }
                    push_runtime_event(
                        current_session,
                        match state_status {
                            "completed" => "Tool completed",
                            "error" => "Tool failed",
                            _ => "Running tool",
                        },
                        "OpenCode updated a tool call.",
                        Some(tool_name.clone()),
                    );
                    current_session.updated_at_ms = now_ms();
                    Ok(())
                })?;
                self.emit_snapshot_update(app, &snapshot);
            }
            "patch" => {
                let activity_id = part.get("id").and_then(Value::as_str).unwrap_or_default();
                if activity_id.is_empty() {
                    return Ok(());
                }
                let files = part
                    .get("files")
                    .and_then(Value::as_array)
                    .cloned()
                    .unwrap_or_default();
                let details =
                    (!files.is_empty()).then(|| truncate_json_details(&json!({ "files": files })));
                let snapshot = self.mutate_session(session_id, |current_session| {
                    if let Some(activity) = current_session
                        .activities
                        .iter_mut()
                        .find(|activity| activity.id == activity_id)
                    {
                        activity.status = AgentActivityStatus::Completed;
                        activity.completed_at_ms = Some(now_ms());
                        if let Some(next_details) = details.clone() {
                            activity.details = Some(next_details);
                        }
                        refresh_activity_metadata(activity);
                    } else {
                        current_session.activities.push(create_activity(
                            activity_id.to_string(),
                            "file_change".to_string(),
                            "patch".to_string(),
                            AgentActivityStatus::Completed,
                            details.clone(),
                            now_ms(),
                            Some(now_ms()),
                        ));
                    }
                    push_runtime_event(
                        current_session,
                        "Applied changes",
                        "OpenCode reported a patch update.",
                        None,
                    );
                    current_session.updated_at_ms = now_ms();
                    Ok(())
                })?;
                self.emit_snapshot_update(app, &snapshot);
            }
            "agent" | "subtask" => {
                let activity_id = part
                    .get("id")
                    .and_then(Value::as_str)
                    .unwrap_or_default()
                    .to_string();
                if activity_id.is_empty() {
                    return Ok(());
                }
                let title = part
                    .get("name")
                    .and_then(Value::as_str)
                    .or_else(|| part.get("agent").and_then(Value::as_str))
                    .unwrap_or("subagent")
                    .to_string();
                let details = part
                    .get("description")
                    .and_then(Value::as_str)
                    .or_else(|| part.get("prompt").and_then(Value::as_str))
                    .map(truncate_details);
                let snapshot = self.mutate_session(session_id, |current_session| {
                    if !current_session
                        .activities
                        .iter()
                        .any(|activity| activity.id == activity_id)
                    {
                        current_session.activities.push(create_activity(
                            activity_id.clone(),
                            "subagent".to_string(),
                            title.clone(),
                            AgentActivityStatus::Completed,
                            details.clone(),
                            now_ms(),
                            Some(now_ms()),
                        ));
                    }
                    push_runtime_event(
                        current_session,
                        "Running subagent",
                        "OpenCode reported a subagent step.",
                        Some(title.clone()),
                    );
                    current_session.updated_at_ms = now_ms();
                    Ok(())
                })?;
                self.emit_snapshot_update(app, &snapshot);
            }
            "step-start" => {
                let snapshot = self.mutate_session(session_id, |current_session| {
                    push_runtime_event(
                        current_session,
                        "Running step",
                        "OpenCode started a new step.",
                        None,
                    );
                    current_session.updated_at_ms = now_ms();
                    Ok(())
                })?;
                self.emit_snapshot_update(app, &snapshot);
            }
            "step-finish" => {
                let snapshot = self.mutate_session(session_id, |current_session| {
                    push_runtime_event(
                        current_session,
                        "Completed step",
                        "OpenCode finished a step.",
                        part.get("reason")
                            .and_then(Value::as_str)
                            .map(str::to_string),
                    );
                    current_session.updated_at_ms = now_ms();
                    Ok(())
                })?;
                self.emit_snapshot_update(app, &snapshot);
            }
            "retry" => {
                let snapshot = self.mutate_session(session_id, |current_session| {
                    push_runtime_event(
                        current_session,
                        "Retrying",
                        "OpenCode reported a provider retry.",
                        part.get("error").map(read_opencode_error_message),
                    );
                    current_session.updated_at_ms = now_ms();
                    Ok(())
                })?;
                self.emit_snapshot_update(app, &snapshot);
            }
            "compaction" => {
                let snapshot = self.mutate_session(session_id, |current_session| {
                    push_runtime_event(
                        current_session,
                        "Context compacted",
                        "OpenCode compacted the session context.",
                        None,
                    );
                    current_session.updated_at_ms = now_ms();
                    Ok(())
                })?;
                self.emit_snapshot_update(app, &snapshot);
            }
            _ => {}
        }

        Ok(())
    }
}

pub(super) async fn respond_to_opencode_permission(
    base_url: &str,
    directory: &str,
    session_id: &str,
    permission_id: &str,
    response: &str,
) -> Result<(), String> {
    let client = Client::new();
    let http_response = client
        .post(format!(
            "{base_url}/session/{session_id}/permissions/{permission_id}"
        ))
        .query(&[("directory", directory)])
        .json(&json!({
            "response": response,
        }))
        .send()
        .await
        .map_err(|error| format!("Failed to respond to OpenCode permission request: {error}"))?;

    if http_response.status().is_success() {
        return Ok(());
    }

    let status = http_response.status();
    let details = read_response_error_body(http_response).await;
    Err(format!(
        "OpenCode permission response failed with status {status}: {details}"
    ))
}

async fn wait_for_opencode_server_ready(
    client: &Client,
    base_url: &str,
) -> Result<Option<String>, String> {
    let health_url = format!("{base_url}/global/health");
    for _ in 0..40 {
        match client.get(&health_url).send().await {
            Ok(response) if response.status().is_success() => {
                let payload = response.json::<Value>().await.map_err(|error| {
                    format!("Failed to decode OpenCode health response: {error}")
                })?;
                let version = payload
                    .get("version")
                    .and_then(Value::as_str)
                    .map(str::to_string);
                return Ok(version);
            }
            Ok(_) | Err(_) => {
                tokio::time::sleep(Duration::from_millis(100)).await;
            }
        }
    }

    Err("Timed out waiting for the OpenCode server to become ready.".to_string())
}

async fn open_opencode_event_stream(
    client: &Client,
    base_url: &str,
    directory: &str,
) -> Result<Response, String> {
    let response = client
        .get(format!("{base_url}/event"))
        .query(&[("directory", directory)])
        .send()
        .await
        .map_err(|error| format!("Failed to subscribe to the OpenCode event stream: {error}"))?;

    if response.status().is_success() {
        return Ok(response);
    }

    let status = response.status();
    let details = read_response_error_body(response).await;
    Err(format!(
        "OpenCode event subscription failed with status {status}: {details}"
    ))
}

async fn opencode_session_exists(
    client: &Client,
    base_url: &str,
    directory: &str,
    session_id: &str,
) -> Result<bool, String> {
    let response = client
        .get(format!("{base_url}/session/{session_id}"))
        .query(&[("directory", directory)])
        .send()
        .await
        .map_err(|error| format!("Failed to inspect OpenCode session {session_id}: {error}"))?;

    match response.status() {
        StatusCode::OK => Ok(true),
        StatusCode::NOT_FOUND => Ok(false),
        status => {
            let details = read_response_error_body(response).await;
            Err(format!(
                "OpenCode session lookup failed with status {status}: {details}"
            ))
        }
    }
}

async fn send_opencode_prompt(
    client: &Client,
    base_url: &str,
    directory: &str,
    opencode_session_id: &str,
    session: &AgentSessionSnapshot,
    turn: &AgentTurnInvocation,
) -> Result<(), String> {
    let mut body = json!({
        "agent": opencode_agent_for_interaction_mode(turn.interaction_mode),
        "parts": [
            {
                "type": "text",
                "text": turn.prompt,
            }
        ],
    });

    if let Some(model) = build_opencode_model_selection(&session.model)? {
        body["model"] = model;
    }

    let response = client
        .post(format!(
            "{base_url}/session/{opencode_session_id}/prompt_async"
        ))
        .query(&[("directory", directory)])
        .json(&body)
        .send()
        .await
        .map_err(|error| format!("Failed to send prompt to OpenCode: {error}"))?;

    if response.status().is_success() {
        return Ok(());
    }

    let status = response.status();
    let details = read_response_error_body(response).await;
    Err(format!(
        "OpenCode prompt failed with status {status}: {details}"
    ))
}

fn reserve_loopback_port() -> Result<u16, String> {
    let listener = TcpListener::bind(("127.0.0.1", 0))
        .map_err(|error| format!("Failed to reserve a loopback port for OpenCode: {error}"))?;
    let port = listener
        .local_addr()
        .map_err(|error| format!("Failed to inspect the reserved OpenCode port: {error}"))?
        .port();
    drop(listener);
    Ok(port)
}

fn build_opencode_model_selection(model: &str) -> Result<Option<Value>, String> {
    let trimmed = model.trim();
    if trimmed.is_empty() || trimmed.eq_ignore_ascii_case(DEFAULT_OPENCODE_MODEL) {
        return Ok(None);
    }

    let Some((provider_id, model_id)) = trimmed.split_once('/') else {
        return Err(
            "OpenCode models must use the form provider/model, for example anthropic/claude-sonnet-4-5.".to_string(),
        );
    };

    let provider_id = provider_id.trim();
    let model_id = model_id.trim();
    if provider_id.is_empty() || model_id.is_empty() {
        return Err(
            "OpenCode models must use the form provider/model, for example anthropic/claude-sonnet-4-5.".to_string(),
        );
    }

    Ok(Some(json!({
        "providerID": provider_id,
        "modelID": model_id,
    })))
}

fn opencode_agent_for_interaction_mode(interaction_mode: AgentInteractionMode) -> &'static str {
    match interaction_mode {
        AgentInteractionMode::Default => "build",
        AgentInteractionMode::Plan => "plan",
    }
}

fn compute_opencode_part_delta(
    lengths: &mut HashMap<String, usize>,
    part_id: &str,
    full_text: &str,
    explicit_delta: Option<&str>,
) -> String {
    let delta = if let Some(explicit_delta) = explicit_delta.filter(|value| !value.is_empty()) {
        explicit_delta.to_string()
    } else {
        let previous_length = lengths.get(part_id).copied().unwrap_or_default();
        if previous_length > 0
            && full_text.len() >= previous_length
            && full_text.is_char_boundary(previous_length)
        {
            full_text[previous_length..].to_string()
        } else {
            full_text.to_string()
        }
    };

    let next_length = if !full_text.is_empty() {
        full_text.len()
    } else {
        lengths.get(part_id).copied().unwrap_or_default() + delta.len()
    };
    lengths.insert(part_id.to_string(), next_length);
    delta
}

fn build_opencode_tool_details(state: &Value) -> Option<String> {
    let status = state
        .get("status")
        .and_then(Value::as_str)
        .unwrap_or_default();
    match status {
        "completed" => Some(truncate_json_details(&json!({
            "input": state.get("input").cloned().unwrap_or(Value::Null),
            "output": state.get("output").cloned().unwrap_or(Value::Null),
            "metadata": state.get("metadata").cloned().unwrap_or(Value::Null),
        }))),
        "error" => Some(truncate_json_details(&json!({
            "input": state.get("input").cloned().unwrap_or(Value::Null),
            "error": state.get("error").cloned().unwrap_or(Value::Null),
            "metadata": state.get("metadata").cloned().unwrap_or(Value::Null),
        }))),
        _ => Some(truncate_json_details(&json!({
            "input": state.get("input").cloned().unwrap_or(Value::Null),
            "metadata": state.get("metadata").cloned().unwrap_or(Value::Null),
            "raw": state.get("raw").cloned().unwrap_or(Value::Null),
        }))),
    }
}

fn read_opencode_tool_started_at(state: &Value) -> Option<i64> {
    state
        .get("time")
        .and_then(|time| time.get("start"))
        .and_then(Value::as_i64)
}

fn read_opencode_session_id(value: &Value) -> Option<String> {
    value
        .get("id")
        .and_then(Value::as_str)
        .map(str::to_string)
        .or_else(|| {
            value
                .get("info")
                .and_then(|info| info.get("id"))
                .and_then(Value::as_str)
                .map(str::to_string)
        })
}

fn read_opencode_error_message(value: &Value) -> String {
    value
        .get("data")
        .and_then(|data| data.get("message"))
        .and_then(Value::as_str)
        .or_else(|| value.get("message").and_then(Value::as_str))
        .unwrap_or("OpenCode reported an error.")
        .to_string()
}

fn build_opencode_permission_description(permission: &Value) -> Option<String> {
    let mut parts = Vec::new();

    if let Some(permission_type) = permission.get("type").and_then(Value::as_str) {
        parts.push(format!("Type: {permission_type}"));
    }

    if let Some(pattern) = permission.get("pattern") {
        match pattern {
            Value::String(value) if !value.trim().is_empty() => {
                parts.push(format!("Pattern: {}", value.trim()));
            }
            Value::Array(values) => {
                let rendered = values
                    .iter()
                    .filter_map(Value::as_str)
                    .map(str::trim)
                    .filter(|value| !value.is_empty())
                    .collect::<Vec<_>>();
                if !rendered.is_empty() {
                    parts.push(format!("Pattern: {}", rendered.join(", ")));
                }
            }
            _ => {}
        }
    }

    if let Some(metadata) = permission
        .get("metadata")
        .filter(|metadata| !metadata.is_null())
    {
        parts.push(format!("Metadata: {}", truncate_json_details(metadata)));
    }

    (!parts.is_empty()).then(|| parts.join("\n"))
}

fn default_opencode_permission_decisions() -> (Vec<AgentRequestOption>, HashMap<String, String>) {
    let options = vec![
        AgentRequestOption {
            id: "once".to_string(),
            label: "Allow once".to_string(),
            description: Some("Approve this action for this request only.".to_string()),
        },
        AgentRequestOption {
            id: "always".to_string(),
            label: "Always allow".to_string(),
            description: Some("Approve this action and remember the decision.".to_string()),
        },
        AgentRequestOption {
            id: "reject".to_string(),
            label: "Reject".to_string(),
            description: Some("Deny this action.".to_string()),
        },
    ];

    let decisions = options
        .iter()
        .map(|option| (option.id.clone(), option.id.clone()))
        .collect();

    (options, decisions)
}

fn append_stderr_to_error(message: String, stderr_output: &str) -> String {
    if stderr_output.trim().is_empty() {
        return message;
    }
    format!("{message} {}", truncate_details(stderr_output.trim()))
}

async fn read_response_error_body(response: Response) -> String {
    response
        .text()
        .await
        .map(|body| {
            let trimmed = body.trim();
            if trimmed.is_empty() {
                "No response body.".to_string()
            } else {
                truncate_details(trimmed)
            }
        })
        .unwrap_or_else(|error| format!("Failed to read response body: {error}"))
}

#[cfg(test)]
mod tests {
    use super::{build_opencode_model_selection, compute_opencode_part_delta};
    use serde_json::json;
    use std::collections::HashMap;

    #[test]
    fn opencode_default_model_omits_explicit_selection() {
        assert_eq!(
            build_opencode_model_selection("default").expect("default model should parse"),
            None
        );
    }

    #[test]
    fn opencode_model_selection_preserves_nested_model_ids() {
        assert_eq!(
            build_opencode_model_selection("openrouter/deepseek/deepseek-r1")
                .expect("compound model id should parse"),
            Some(json!({
                "providerID": "openrouter",
                "modelID": "deepseek/deepseek-r1",
            }))
        );
    }

    #[test]
    fn opencode_model_selection_rejects_invalid_model_strings() {
        assert!(build_opencode_model_selection("gpt-5").is_err());
    }

    #[test]
    fn opencode_part_delta_uses_explicit_delta_when_available() {
        let mut lengths = HashMap::new();
        let delta =
            compute_opencode_part_delta(&mut lengths, "part-1", "Hello world", Some(" world"));

        assert_eq!(delta, " world");
        assert_eq!(lengths.get("part-1"), Some(&11));
    }

    #[test]
    fn opencode_part_delta_derives_incremental_text_from_full_content() {
        let mut lengths = HashMap::new();
        assert_eq!(
            compute_opencode_part_delta(&mut lengths, "part-1", "Hello", None),
            "Hello"
        );
        assert_eq!(
            compute_opencode_part_delta(&mut lengths, "part-1", "Hello world", None),
            " world"
        );
    }
}
