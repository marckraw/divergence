use super::*;
use serde_json::json;

impl AgentRuntimeState {
    pub(super) async fn run_codex_turn_process(
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
            "Starting Codex App Server.",
            Some(session.model.clone()),
        )?;
        let mut command = Command::new("codex");
        command
            .arg("app-server")
            .current_dir(&session.path)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());

        let mut child = command
            .spawn()
            .map_err(|error| format!("Failed to spawn Codex App Server: {error}"))?;

        let stdin = child
            .stdin
            .take()
            .ok_or_else(|| "Codex App Server stdin was not available.".to_string())?;
        let stdout = child
            .stdout
            .take()
            .ok_or_else(|| "Codex App Server stdout was not available.".to_string())?;
        let stderr = child
            .stderr
            .take()
            .ok_or_else(|| "Codex App Server stderr was not available.".to_string())?;

        let child = Arc::new(AsyncMutex::new(child));
        let (writer_tx, mut writer_rx) = mpsc::unbounded_channel::<String>();
        self.register_running_session(
            session_id,
            RunningSessionHandle {
                child: child.clone(),
                transport: RunningTransport::CodexAppServer {
                    writer: writer_tx.clone(),
                },
            },
        )?;
        self.emit_runtime_event(
            app,
            session_id,
            "Initializing provider",
            "Codex App Server started. Initializing session.",
            None,
        )?;

        let writer_task = tokio::spawn(async move {
            let mut stdin = stdin;
            while let Some(message) = writer_rx.recv().await {
                if stdin.write_all(message.as_bytes()).await.is_err() {
                    break;
                }
                if stdin.write_all(b"\n").await.is_err() {
                    break;
                }
                if stdin.flush().await.is_err() {
                    break;
                }
            }
        });

        let stderr_task = tokio::spawn(async move {
            let mut buffer = Vec::new();
            let mut reader = stderr;
            let _ = reader.read_to_end(&mut buffer).await;
            String::from_utf8_lossy(&buffer).to_string()
        });

        let pending_responses: PendingResponseRegistry =
            Arc::new(Mutex::new(HashMap::<String, PendingResponseSender>::new()));
        let (turn_completed_tx, turn_completed_rx) = oneshot::channel::<Result<(), String>>();
        let turn_completed_tx: TurnCompletionSignal = Arc::new(Mutex::new(Some(turn_completed_tx)));

        let runtime = self.clone();
        let app_handle = app.clone();
        let session_id_owned = session_id.to_string();
        let pending_responses_for_reader = pending_responses.clone();
        let reader_writer = writer_tx.clone();
        let reader_task = tokio::spawn(async move {
            let mut reader = BufReader::new(stdout).lines();
            while let Some(line) = reader
                .next_line()
                .await
                .map_err(|error| format!("Failed reading Codex App Server output: {error}"))?
            {
                runtime.handle_codex_app_server_line(
                    &app_handle,
                    &session_id_owned,
                    &reader_writer,
                    &pending_responses_for_reader,
                    &turn_completed_tx,
                    &line,
                )?;
            }
            Ok::<(), String>(())
        });

        let mut next_request_id = 1_u64;
        self.emit_runtime_event(
            app,
            session_id,
            "Initializing provider",
            "Sending initialize handshake to Codex App Server.",
            None,
        )?;
        send_codex_request(
            &writer_tx,
            &pending_responses,
            &mut next_request_id,
            "initialize",
            json!({
                "clientInfo": {
                    "name": "Divergence",
                    "title": "Divergence",
                    "version": env!("CARGO_PKG_VERSION"),
                },
                "capabilities": {
                    "experimentalApi": true,
                },
            }),
        )
        .await?;
        send_codex_message(&writer_tx, json!({ "method": "initialized" }))?;

        self.emit_runtime_event(
            app,
            session_id,
            "Preparing thread",
            if session.thread_id.is_some() {
                "Resuming existing Codex thread."
            } else {
                "Starting new Codex thread."
            },
            None,
        )?;
        let thread_response = if let Some(thread_id) = session.thread_id.as_deref() {
            send_codex_request(
                &writer_tx,
                &pending_responses,
                &mut next_request_id,
                "thread/resume",
                json!({
                    "threadId": thread_id,
                    "cwd": session.path,
                    "approvalPolicy": if turn.automation_mode { "never" } else { "on-request" },
                    "sandbox": if turn.automation_mode { "danger-full-access" } else { "workspace-write" },
                    "experimentalRawEvents": false,
                    "model": session.model,
                }),
            )
            .await
        } else {
            send_codex_request(
                &writer_tx,
                &pending_responses,
                &mut next_request_id,
                "thread/start",
                json!({
                    "cwd": session.path,
                    "approvalPolicy": if turn.automation_mode { "never" } else { "on-request" },
                    "sandbox": if turn.automation_mode { "danger-full-access" } else { "workspace-write" },
                    "experimentalRawEvents": false,
                    "model": session.model,
                }),
            )
            .await
        }?;

        if let Some(thread_id) = read_codex_thread_id_from_response(&thread_response) {
            let snapshot = self.mutate_session(session_id, |current_session| {
                current_session.thread_id = Some(thread_id);
                push_runtime_event(
                    current_session,
                    "Preparing turn",
                    "Codex thread is ready. Starting the turn.",
                    None,
                );
                current_session.updated_at_ms = now_ms();
                Ok(())
            })?;
            self.emit_snapshot_update(app, &snapshot);
        }

        let thread_id = self
            .get_session(session_id)?
            .and_then(|current_session| current_session.thread_id)
            .ok_or_else(|| "Codex thread id was missing after thread start/resume.".to_string())?;

        let mut turn_input = vec![json!({
            "type": "text",
            "text": turn.prompt,
            "text_elements": [],
        })];
        for attachment in &turn.attachments {
            turn_input.push(json!({
                "type": "image",
                "url": read_codex_attachment_data_url(session_id, attachment)?,
            }));
        }

        let mut turn_start_params = json!({
            "threadId": thread_id,
            "model": session.model,
            "input": turn_input,
            "approvalPolicy": if turn.automation_mode { "never" } else { "on-request" },
        });
        if matches!(turn.interaction_mode, AgentInteractionMode::Plan) {
            turn_start_params["collaborationMode"] = json!({
                "mode": "plan",
                "settings": {
                    "model": session.model,
                    "reasoning_effort": "medium",
                    "developer_instructions": CODEX_PLAN_MODE_DEVELOPER_INSTRUCTIONS,
                }
            });
        } else {
            turn_start_params["collaborationMode"] = json!({
                "mode": "default",
                "settings": {
                    "model": session.model,
                    "reasoning_effort": "medium",
                    "developer_instructions": CODEX_DEFAULT_MODE_DEVELOPER_INSTRUCTIONS,
                }
            });
        }

        self.emit_runtime_event(
            app,
            session_id,
            "Preparing turn",
            "Waiting for first Codex runtime events.",
            None,
        )?;
        send_codex_request(
            &writer_tx,
            &pending_responses,
            &mut next_request_id,
            "turn/start",
            turn_start_params,
        )
        .await?;

        let mut turn_completed_rx = turn_completed_rx;
        let turn_result = loop {
            tokio::select! {
                completion = &mut turn_completed_rx => {
                    break completion.map_err(|_| "Codex turn completion signal was lost.".to_string())?;
                }
                _ = tokio::time::sleep(Duration::from_millis(200)) => {
                    if !self.is_session_stopping(session_id) {
                        continue;
                    }
                    let status = {
                        let mut child = child.lock().await;
                        child
                            .try_wait()
                            .map_err(|error| format!("Failed checking Codex App Server status: {error}"))?
                    };
                    if status.is_some() {
                        break Ok(());
                    }
                }
            }
        };

        self.mark_session_stopping(session_id);
        {
            let mut child = child.lock().await;
            let _ = child.kill().await;
        }

        let reader_result = reader_task
            .await
            .map_err(|error| format!("Failed joining Codex App Server reader task: {error}"))?;
        let stderr_output = stderr_task
            .await
            .map_err(|error| format!("Failed collecting Codex App Server stderr: {error}"))?;
        let _ = writer_task.await;

        if let Err(error) = reader_result {
            if self.is_session_stopping(session_id) {
                return turn_result;
            }
            return Err(error);
        }

        if self.is_session_stopping(session_id) && turn_result.is_ok() {
            return Ok(());
        }

        if !stderr_output.trim().is_empty() && turn_result.is_ok() {
            let classified = classify_codex_app_server_stderr(&stderr_output);
            if let Some(message) = classified {
                return Err(message);
            }
        }

        turn_result
    }

    fn handle_codex_app_server_line(
        &self,
        app: &AppHandle,
        session_id: &str,
        writer: &mpsc::UnboundedSender<String>,
        pending_responses: &PendingResponseRegistry,
        turn_completed: &TurnCompletionSignal,
        line: &str,
    ) -> Result<(), String> {
        let parsed: Value = match serde_json::from_str(line) {
            Ok(value) => value,
            Err(_) => return Ok(()),
        };

        if let Some(id) = parsed.get("id") {
            if parsed.get("method").is_some() {
                self.handle_codex_app_server_request(app, session_id, id.clone(), &parsed)?;
                return Ok(());
            }

            let key = normalize_json_rpc_id_key(id);
            let sender = {
                let mut pending = pending_responses
                    .lock()
                    .map_err(|error| format!("Pending response lock poisoned: {error}"))?;
                pending.remove(&key)
            };
            if let Some(sender) = sender {
                if let Some(error) = parsed.get("error") {
                    let message = error
                        .get("message")
                        .and_then(Value::as_str)
                        .unwrap_or("Codex App Server request failed.")
                        .to_string();
                    let _ = sender.send(Err(message));
                } else {
                    let _ = sender.send(Ok(parsed.get("result").cloned().unwrap_or(Value::Null)));
                }
            }
            return Ok(());
        }

        let Some(method) = parsed.get("method").and_then(Value::as_str) else {
            return Ok(());
        };
        let params = parsed.get("params").cloned().unwrap_or(Value::Null);
        self.handle_codex_app_server_notification(
            app,
            session_id,
            writer,
            method,
            params,
            turn_completed,
        )
    }

    fn handle_codex_app_server_notification(
        &self,
        app: &AppHandle,
        session_id: &str,
        _writer: &mpsc::UnboundedSender<String>,
        method: &str,
        params: Value,
        turn_completed: &TurnCompletionSignal,
    ) -> Result<(), String> {
        match method {
            "thread/started" => {
                if let Some(thread_id) = params
                    .get("thread")
                    .and_then(|thread| thread.get("id"))
                    .and_then(Value::as_str)
                    .or_else(|| params.get("threadId").and_then(Value::as_str))
                {
                    let snapshot = self.mutate_session(session_id, |session| {
                        session.thread_id = Some(thread_id.to_string());
                        push_runtime_event(
                            session,
                            "Preparing turn",
                            "Codex thread started.",
                            Some(thread_id.to_string()),
                        );
                        session.updated_at_ms = now_ms();
                        Ok(())
                    })?;
                    self.emit_snapshot_update(app, &snapshot);
                }
            }
            "turn/started" => {
                let snapshot = self.mutate_session(session_id, |session| {
                    session.status = AgentSessionStatus::Busy;
                    session.runtime_status = if session.pending_request.is_some() {
                        AgentRuntimeStatus::Waiting
                    } else {
                        AgentRuntimeStatus::Running
                    };
                    push_runtime_event(
                        session,
                        "Waiting for model",
                        "Codex acknowledged the turn and is preparing a response.",
                        None,
                    );
                    session.updated_at_ms = now_ms();
                    Ok(())
                })?;
                self.emit_snapshot_update(app, &snapshot);
            }
            "thread/tokenUsage/updated" => {
                let usage = params.get("usage").unwrap_or(&params);
                let snapshot = self.mutate_session(session_id, |session| {
                    session.conversation_context = Some(
                        normalize_codex_conversation_context(usage).unwrap_or_else(|| {
                            codex_unavailable_conversation_context(
                                "Codex did not provide a usable conversation-context update.",
                            )
                        }),
                    );
                    push_runtime_event(
                        session,
                        "Context updated",
                        "Codex reported current conversation context.",
                        None,
                    );
                    session.updated_at_ms = now_ms();
                    Ok(())
                })?;
                self.emit_snapshot_update(app, &snapshot);
            }
            "item/agentMessage/delta" => {
                let item_id = read_codex_route_item_id(&params);
                let delta = params
                    .get("delta")
                    .and_then(Value::as_str)
                    .unwrap_or_default();
                if !delta.is_empty() {
                    let snapshot = self.mutate_session(session_id, |session| {
                        append_assistant_text(session, item_id.as_deref(), delta);
                        push_runtime_event(
                            session,
                            "Streaming response",
                            "Received Codex response text.",
                            None,
                        );
                        session.updated_at_ms = now_ms();
                        Ok(())
                    })?;
                    self.emit_snapshot_update(app, &snapshot);
                }
            }
            "item/started" => {
                let item = params.get("item").cloned().unwrap_or(Value::Null);
                let item_type = item
                    .get("type")
                    .and_then(Value::as_str)
                    .unwrap_or_default();

                if item_type == "agentMessage" {
                    let activity_id = item
                        .get("id")
                        .and_then(Value::as_str)
                        .map(str::to_string);
                    let snapshot = self.mutate_session(session_id, |session| {
                        ensure_assistant_message(session, activity_id.as_deref());
                        push_runtime_event(
                            session,
                            "Streaming response",
                            "Codex started a new assistant message item.",
                            None,
                        );
                        session.updated_at_ms = now_ms();
                        Ok(())
                    })?;
                    self.emit_snapshot_update(app, &snapshot);
                } else if item_type == "commandExecution" {
                    let activity_id = item
                        .get("id")
                        .and_then(Value::as_str)
                        .map(str::to_string)
                        .unwrap_or_else(|| format!("activity-{}", Uuid::new_v4()));
                    let command = item
                        .get("command")
                        .and_then(Value::as_str)
                        .unwrap_or("Command")
                        .to_string();
                    let cwd = item
                        .get("cwd")
                        .and_then(Value::as_str)
                        .map(str::to_string);
                    let snapshot = self.mutate_session(session_id, |session| {
                        let cwd_details = cwd.clone();
                        if !session.activities.iter().any(|activity| activity.id == activity_id) {
                            session.activities.push(create_activity(
                                activity_id.clone(),
                                "command_execution".to_string(),
                                command.clone(),
                                AgentActivityStatus::Running,
                                cwd_details,
                                now_ms(),
                                None,
                            ));
                        }
                        push_runtime_event(
                            session,
                            "Running command",
                            "Codex started a command execution.",
                            Some(command.clone()),
                        );
                        session.updated_at_ms = now_ms();
                        Ok(())
                    })?;
                    self.emit_snapshot_update(app, &snapshot);
                } else if item_type == "mcpToolCall" {
                    let activity_id = item
                        .get("id")
                        .and_then(Value::as_str)
                        .map(str::to_string)
                        .unwrap_or_else(|| format!("activity-{}", Uuid::new_v4()));
                    let title = format!(
                        "{}:{}",
                        item.get("server").and_then(Value::as_str).unwrap_or("mcp"),
                        item.get("tool").and_then(Value::as_str).unwrap_or("tool")
                    );
                    let details = item.get("arguments").map(truncate_json_details);
                    let snapshot = self.mutate_session(session_id, |session| {
                        let activity_title = title.clone();
                        let activity_details = details.clone();
                        if !session.activities.iter().any(|activity| activity.id == activity_id) {
                            session.activities.push(create_activity(
                                activity_id.clone(),
                                "mcp_tool".to_string(),
                                activity_title,
                                AgentActivityStatus::Running,
                                activity_details,
                                now_ms(),
                                None,
                            ));
                        }
                        push_runtime_event(
                            session,
                            "Running tool",
                            "Codex started an MCP tool call.",
                            Some(title.clone()),
                        );
                        session.updated_at_ms = now_ms();
                        Ok(())
                    })?;
                    self.emit_snapshot_update(app, &snapshot);
                }
            }
            "item/completed" => {
                let item = params.get("item").cloned().unwrap_or(Value::Null);
                let item_type = item
                    .get("type")
                    .and_then(Value::as_str)
                    .unwrap_or_default();

                if item_type == "agentMessage" {
                    let item_id = item
                        .get("id")
                        .and_then(Value::as_str)
                        .map(str::to_string);
                    let text = item.get("text").and_then(Value::as_str).unwrap_or_default();
                    let snapshot = self.mutate_session(session_id, |session| {
                        if !text.is_empty()
                            && assistant_message_text(session, item_id.as_deref()).trim().is_empty()
                        {
                            append_assistant_paragraph(session, item_id.as_deref(), text);
                        }
                        if let Some(message) = assistant_message_mut(session, item_id.as_deref()) {
                            message.status = AgentMessageStatus::Done;
                        }
                        push_runtime_event(
                            session,
                            "Streaming response",
                            "Codex completed an assistant message item.",
                            None,
                        );
                        session.updated_at_ms = now_ms();
                        Ok(())
                    })?;
                    self.emit_snapshot_update(app, &snapshot);
                } else if item_type == "commandExecution" {
                    let activity_id = item
                        .get("id")
                        .and_then(Value::as_str)
                        .unwrap_or_default()
                        .to_string();
                    let aggregated_output = item
                        .get("aggregatedOutput")
                        .and_then(Value::as_str)
                        .map(truncate_details);
                    let exit_code = item.get("exitCode").and_then(Value::as_i64);
                    let activity_status = if exit_code.unwrap_or_default() == 0 {
                        AgentActivityStatus::Completed
                    } else {
                        AgentActivityStatus::Error
                    };
                    let snapshot = self.mutate_session(session_id, |session| {
                        complete_activity(session, &activity_id, aggregated_output, activity_status);
                        push_runtime_event(
                            session,
                            if matches!(activity_status, AgentActivityStatus::Error) {
                                "Command failed"
                            } else {
                                "Command completed"
                            },
                            "Codex finished a command execution.",
                            None,
                        );
                        session.updated_at_ms = now_ms();
                        Ok(())
                    })?;
                    self.emit_snapshot_update(app, &snapshot);
                } else if item_type == "fileChange" {
                    let activity_id = item
                        .get("id")
                        .and_then(Value::as_str)
                        .unwrap_or_default()
                        .to_string();
                    let details = item.get("changes").map(truncate_json_details);
                    let snapshot = self.mutate_session(session_id, |session| {
                        let completed_at_ms = now_ms();
                        if let Some(activity) = session
                            .activities
                            .iter_mut()
                            .find(|activity| activity.id == activity_id)
                        {
                            activity.status = AgentActivityStatus::Completed;
                            activity.completed_at_ms = Some(completed_at_ms);
                            if let Some(details) = details.clone() {
                                activity.details = Some(details);
                            }
                            refresh_activity_metadata(activity);
                        } else {
                            session.activities.push(create_activity(
                                activity_id.clone(),
                                "file_change".to_string(),
                                "fileChange".to_string(),
                                AgentActivityStatus::Completed,
                                details,
                                completed_at_ms,
                                Some(completed_at_ms),
                            ));
                        }
                        push_runtime_event(
                            session,
                            "Applied changes",
                            "Codex reported a file change item.",
                            None,
                        );
                        session.updated_at_ms = now_ms();
                        Ok(())
                    })?;
                    self.emit_snapshot_update(app, &snapshot);
                } else if item_type == "mcpToolCall" {
                    let activity_id = item
                        .get("id")
                        .and_then(Value::as_str)
                        .unwrap_or_default()
                        .to_string();
                    let details = item
                        .get("result")
                        .map(truncate_json_details)
                        .or_else(|| item.get("error").map(truncate_json_details));
                    let status = if item.get("error").is_some() {
                        AgentActivityStatus::Error
                    } else {
                        AgentActivityStatus::Completed
                    };
                    let snapshot = self.mutate_session(session_id, |session| {
                        complete_activity(session, &activity_id, details, status);
                        push_runtime_event(
                            session,
                            if matches!(status, AgentActivityStatus::Error) {
                                "Tool failed"
                            } else {
                                "Tool completed"
                            },
                            "Codex finished an MCP tool call.",
                            None,
                        );
                        session.updated_at_ms = now_ms();
                        Ok(())
                    })?;
                    self.emit_snapshot_update(app, &snapshot);
                }
            }
            "turn/completed" => {
                let turn = params.get("turn").cloned().unwrap_or(Value::Null);
                let status = turn
                    .get("status")
                    .and_then(Value::as_str)
                    .unwrap_or("completed");
                let error_message = turn
                    .get("error")
                    .and_then(|error| error.get("message"))
                    .and_then(Value::as_str)
                    .map(str::to_string);
                let conversation_context = turn
                    .get("usage")
                    .and_then(normalize_codex_conversation_context)
                    .or_else(|| params.get("usage").and_then(normalize_codex_conversation_context));
                let snapshot = self.mutate_session(session_id, |session| {
                    if let Some(next_context) = conversation_context.clone() {
                        session.conversation_context = Some(next_context);
                    }
                    if let Some(message) = last_assistant_message_mut(session) {
                        if matches!(message.status, AgentMessageStatus::Streaming) {
                            message.status = if error_message.is_some() {
                                AgentMessageStatus::Error
                            } else {
                                AgentMessageStatus::Done
                            };
                            if message.content.trim().is_empty() && error_message.is_some() {
                                message.content = error_message.clone().unwrap_or_default();
                            }
                        }
                    }
                    session.status = if error_message.is_some() {
                        AgentSessionStatus::Idle
                    } else {
                        AgentSessionStatus::Active
                    };
                    session.runtime_status = if error_message.is_some() {
                        AgentRuntimeStatus::Error
                    } else {
                        AgentRuntimeStatus::Idle
                    };
                    session.pending_request = None;
                    session.error_message = error_message.clone();
                    push_runtime_event(
                        session,
                        if error_message.is_some() {
                            "Turn failed"
                        } else {
                            "Completed"
                        },
                        if error_message.is_some() {
                            "Codex finished the turn with an error."
                        } else {
                            "Codex completed the turn."
                        },
                        error_message.clone(),
                    );
                    session.updated_at_ms = now_ms();
                    Ok(())
                })?;
                self.emit_snapshot_update(app, &snapshot);

                let completion = if status == "failed" || error_message.is_some() {
                    Err(error_message.unwrap_or_else(|| "Codex turn failed.".to_string()))
                } else {
                    Ok(())
                };
                if let Ok(mut sender) = turn_completed.lock() {
                    if let Some(turn_sender) = sender.take() {
                        let _ = turn_sender.send(completion);
                    }
                }
            }
            "error" => {
                let error_message = params
                    .get("error")
                    .and_then(|error| error.get("message"))
                    .and_then(Value::as_str)
                    .unwrap_or("Codex App Server error.")
                    .to_string();
                let snapshot = self.mutate_session(session_id, |session| {
                    session.status = AgentSessionStatus::Idle;
                    session.runtime_status = AgentRuntimeStatus::Error;
                    session.error_message = Some(error_message.clone());
                    push_runtime_event(
                        session,
                        "Errored",
                        "Codex App Server emitted an error.",
                        Some(error_message.clone()),
                    );
                    session.updated_at_ms = now_ms();
                    Ok(())
                })?;
                self.emit_snapshot_update(app, &snapshot);
            }
            _ => {}
        }

        Ok(())
    }

    fn handle_codex_app_server_request(
        &self,
        app: &AppHandle,
        session_id: &str,
        json_rpc_id: Value,
        parsed: &Value,
    ) -> Result<(), String> {
        let method = parsed
            .get("method")
            .and_then(Value::as_str)
            .unwrap_or_default();
        let params = parsed.get("params").cloned().unwrap_or(Value::Null);

        match method {
            "item/commandExecution/requestApproval" => {
                let command = params
                    .get("command")
                    .and_then(Value::as_str)
                    .unwrap_or("Command execution")
                    .to_string();
                let reason = params
                    .get("reason")
                    .and_then(Value::as_str)
                    .map(str::to_string);
                let cwd = params
                    .get("cwd")
                    .and_then(Value::as_str)
                    .map(str::to_string);
                let decisions = collect_codex_approval_decisions(
                    params.get("availableDecisions").and_then(Value::as_array),
                );
                let request_id = format!("request-{}", Uuid::new_v4());
                self.open_pending_request(
                    app,
                    session_id,
                    AgentRequest {
                        id: request_id.clone(),
                        kind: AgentRequestKind::Approval,
                        title: command,
                        description: build_codex_approval_description(reason, cwd),
                        options: Some(
                            decisions
                                .iter()
                                .map(|(option, _)| option.clone())
                                .collect(),
                        ),
                        questions: None,
                        status: AgentRequestStatus::Open,
                        opened_at_ms: now_ms(),
                        resolved_at_ms: None,
                    },
                )?;
                self.store_pending_request_transport(
                    &request_id,
                    PendingRequestTransport::CodexApproval {
                        session_id: session_id.to_string(),
                        json_rpc_id,
                        decisions: decisions
                            .into_iter()
                            .map(|(option, value)| (option.id, value))
                            .collect(),
                    },
                )?;
            }
            "item/fileChange/requestApproval" => {
                let request_id = format!("request-{}", Uuid::new_v4());
                self.open_pending_request(
                    app,
                    session_id,
                    AgentRequest {
                        id: request_id.clone(),
                        kind: AgentRequestKind::Approval,
                        title: "Approve file changes".to_string(),
                        description: params
                            .get("reason")
                            .and_then(Value::as_str)
                            .map(str::to_string),
                        options: Some(default_codex_approval_options()),
                        questions: None,
                        status: AgentRequestStatus::Open,
                        opened_at_ms: now_ms(),
                        resolved_at_ms: None,
                    },
                )?;
                self.store_pending_request_transport(
                    &request_id,
                    PendingRequestTransport::CodexApproval {
                        session_id: session_id.to_string(),
                        json_rpc_id,
                        decisions: default_codex_approval_decisions(),
                    },
                )?;
            }
            "item/tool/requestUserInput" => {
                let questions = params
                    .get("questions")
                    .and_then(Value::as_array)
                    .cloned()
                    .unwrap_or_default();
                let request_id = format!("request-{}", Uuid::new_v4());
                let mapped_questions = questions
                    .iter()
                    .map(map_codex_user_input_question)
                    .collect::<Vec<_>>();
                let title = mapped_questions
                    .first()
                    .map(|question| question.header.clone())
                    .unwrap_or_else(|| "User input requested".to_string());
                self.open_pending_request(
                    app,
                    session_id,
                    AgentRequest {
                        id: request_id.clone(),
                        kind: AgentRequestKind::UserInput,
                        title,
                        description: None,
                        options: None,
                        questions: Some(mapped_questions),
                        status: AgentRequestStatus::Open,
                        opened_at_ms: now_ms(),
                        resolved_at_ms: None,
                    },
                )?;
                self.store_pending_request_transport(
                    &request_id,
                    PendingRequestTransport::CodexUserInput {
                        session_id: session_id.to_string(),
                        json_rpc_id,
                        question_count: questions.len(),
                    },
                )?;
            }
            _ => {}
        }

        Ok(())
    }
}

const CODEX_DEFAULT_MODE_DEVELOPER_INSTRUCTIONS: &str =
    "Work directly in the repository, explain key changes clearly, and keep output concise and actionable.";
const CODEX_PLAN_MODE_DEVELOPER_INSTRUCTIONS: &str =
    "Do not make changes yet. Investigate the repository, propose a concrete implementation plan, and ask concise clarifying questions when needed.";

async fn send_codex_request(
    writer: &mpsc::UnboundedSender<String>,
    pending_responses: &PendingResponseRegistry,
    next_request_id: &mut u64,
    method: &str,
    params: Value,
) -> Result<Value, String> {
    let request_id = *next_request_id;
    *next_request_id += 1;

    let (response_tx, response_rx) = oneshot::channel::<Result<Value, String>>();
    {
        let mut pending = pending_responses
            .lock()
            .map_err(|error| format!("Pending response lock poisoned: {error}"))?;
        pending.insert(request_id.to_string(), response_tx);
    }

    send_codex_message(
        writer,
        json!({
            "id": request_id,
            "method": method,
            "params": params,
        }),
    )?;

    let response = timeout(Duration::from_secs(20), response_rx)
        .await
        .map_err(|_| format!("Timed out waiting for Codex App Server response to {method}."))?
        .map_err(|_| format!("Codex App Server response channel closed for {method}."))??;
    Ok(response)
}

pub(super) fn send_codex_message(
    writer: &mpsc::UnboundedSender<String>,
    message: Value,
) -> Result<(), String> {
    writer
        .send(message.to_string())
        .map_err(|_| "Failed to write to Codex App Server stdin.".to_string())
}

fn normalize_json_rpc_id_key(id: &Value) -> String {
    match id {
        Value::String(value) => value.clone(),
        Value::Number(value) => value.to_string(),
        _ => id.to_string(),
    }
}

fn read_codex_thread_id_from_response(response: &Value) -> Option<String> {
    response
        .get("thread")
        .and_then(|thread| thread.get("id"))
        .and_then(Value::as_str)
        .map(str::to_string)
        .or_else(|| response.get("threadId").and_then(Value::as_str).map(str::to_string))
}

fn codex_unavailable_conversation_context(detail: &str) -> AgentConversationContext {
    AgentConversationContext {
        status: AgentConversationContextStatus::Unavailable,
        label: "Unavailable".to_string(),
        fraction_used: None,
        fraction_remaining: None,
        detail: Some(detail.to_string()),
        source: AgentConversationContextSource::Codex,
    }
}

fn normalize_codex_conversation_context(value: &Value) -> Option<AgentConversationContext> {
    let fraction_remaining = find_fraction(
        value,
        &[
            "fractionRemaining",
            "remainingFraction",
            "fraction_remaining",
            "remaining_fraction",
        ],
    )
    .or_else(|| {
        find_percent_fraction(
            value,
            &[
                "remainingPercent",
                "percentRemaining",
                "remaining_percent",
                "percent_remaining",
            ],
        )
    })
    .or_else(|| {
        let remaining_tokens = find_numeric(
            value,
            &[
                "remainingTokens",
                "tokensRemaining",
                "remaining_tokens",
                "tokens_remaining",
            ],
        )?;
        let token_limit = find_numeric(
            value,
            &[
                "maxTokens",
                "tokenLimit",
                "contextWindow",
                "maxContextTokens",
                "max_tokens",
                "token_limit",
                "context_window",
                "max_context_tokens",
                "limit",
            ],
        )?;
        Some(clamp_fraction(remaining_tokens / token_limit))
    });

    let fraction_used = find_fraction(
        value,
        &[
            "fractionUsed",
            "usedFraction",
            "fraction_used",
            "used_fraction",
        ],
    )
    .or_else(|| {
        find_percent_fraction(
            value,
            &[
                "usedPercent",
                "percentUsed",
                "used_percent",
                "percent_used",
                "utilization",
            ],
        )
    })
    .or_else(|| {
        let used_tokens = find_numeric(
            value,
            &[
                "usedTokens",
                "tokensUsed",
                "totalTokens",
                "tokenCount",
                "used_tokens",
                "tokens_used",
                "total_tokens",
                "token_count",
            ],
        )?;
        let token_limit = find_numeric(
            value,
            &[
                "maxTokens",
                "tokenLimit",
                "contextWindow",
                "maxContextTokens",
                "max_tokens",
                "token_limit",
                "context_window",
                "max_context_tokens",
                "limit",
            ],
        )?;
        Some(clamp_fraction(used_tokens / token_limit))
    })
    .or_else(|| fraction_remaining.map(|remaining| clamp_fraction(1.0 - remaining)));

    let fraction_remaining = fraction_remaining
        .or_else(|| fraction_used.map(|used| clamp_fraction(1.0 - used)))?;
    let fraction_used = fraction_used.unwrap_or_else(|| clamp_fraction(1.0 - fraction_remaining));

    Some(AgentConversationContext {
        status: AgentConversationContextStatus::Available,
        label: format!("{}% left", (fraction_remaining * 100.0).round() as i64),
        fraction_used: Some(fraction_used),
        fraction_remaining: Some(fraction_remaining),
        detail: Some("Current conversation context remaining.".to_string()),
        source: AgentConversationContextSource::Codex,
    })
}

fn find_fraction(value: &Value, keys: &[&str]) -> Option<f64> {
    find_numeric(value, keys).map(clamp_fraction)
}

fn find_percent_fraction(value: &Value, keys: &[&str]) -> Option<f64> {
    find_numeric(value, keys).map(|value| {
        let normalized = if value > 1.0 { value / 100.0 } else { value };
        clamp_fraction(normalized)
    })
}

fn find_numeric(value: &Value, keys: &[&str]) -> Option<f64> {
    match value {
        Value::Object(map) => {
            for key in keys {
                if let Some(number) = map.get(*key).and_then(value_as_f64) {
                    return Some(number);
                }
            }
            for child in map.values() {
                if let Some(number) = find_numeric(child, keys) {
                    return Some(number);
                }
            }
            None
        }
        Value::Array(items) => items.iter().find_map(|item| find_numeric(item, keys)),
        _ => None,
    }
}

fn value_as_f64(value: &Value) -> Option<f64> {
    match value {
        Value::Number(number) => number.as_f64(),
        Value::String(string) => string.parse::<f64>().ok(),
        _ => None,
    }
}

fn clamp_fraction(value: f64) -> f64 {
    value.clamp(0.0, 1.0)
}

fn collect_codex_approval_decisions(
    available_decisions: Option<&Vec<Value>>,
) -> Vec<(AgentRequestOption, Value)> {
    let mut decisions = Vec::new();
    let source = available_decisions.cloned().unwrap_or_else(|| {
        vec![
            Value::String("accept".to_string()),
            Value::String("decline".to_string()),
        ]
    });

    for (index, decision) in source.into_iter().enumerate() {
        let (option_id, label, description) = map_codex_approval_decision(&decision, index);
        decisions.push((
            AgentRequestOption {
                id: option_id,
                label,
                description,
            },
            decision,
        ));
    }

    decisions
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn normalizes_codex_context_from_percentage_payload() {
        let context = normalize_codex_conversation_context(&json!({
            "remainingPercent": 7
        }))
        .expect("expected context");

        assert!(matches!(
            context.status,
            AgentConversationContextStatus::Available
        ));
        assert_eq!(context.label, "7% left");
        assert_eq!(context.fraction_remaining, Some(0.07));
        assert_eq!(context.fraction_used, Some(0.93));
    }

    #[test]
    fn normalizes_codex_context_from_used_tokens_payload() {
        let context = normalize_codex_conversation_context(&json!({
            "usedTokens": 9300,
            "maxTokens": 10000
        }))
        .expect("expected context");

        assert_eq!(context.label, "7% left");
        assert_eq!(context.fraction_remaining, Some(0.07));
    }

    #[test]
    fn returns_none_for_unusable_codex_context_payload() {
        assert!(normalize_codex_conversation_context(&json!({
            "foo": "bar"
        }))
        .is_none());
    }
}

fn default_codex_approval_decisions() -> HashMap<String, Value> {
    collect_codex_approval_decisions(None)
        .into_iter()
        .map(|(option, value)| (option.id, value))
        .collect()
}

fn default_codex_approval_options() -> Vec<AgentRequestOption> {
    collect_codex_approval_decisions(None)
        .into_iter()
        .map(|(option, _)| option)
        .collect()
}

fn map_codex_approval_decision(
    decision: &Value,
    index: usize,
) -> (String, String, Option<String>) {
    if let Some(value) = decision.as_str() {
        match value {
            "accept" => (
                "accept".to_string(),
                "Approve".to_string(),
                Some("Allow this action once.".to_string()),
            ),
            "acceptForSession" => (
                "accept-for-session".to_string(),
                "Approve For Session".to_string(),
                Some("Allow similar actions without prompting again in this session.".to_string()),
            ),
            "decline" => (
                "decline".to_string(),
                "Deny".to_string(),
                Some("Reject this action.".to_string()),
            ),
            "cancel" => (
                "cancel".to_string(),
                "Cancel".to_string(),
                Some("Abort the pending request.".to_string()),
            ),
            other => (format!("decision-{index}"), other.to_string(), None),
        }
    } else if let Some(object) = decision.as_object() {
        if let Some((key, _)) = object.iter().next() {
            return (
                format!("decision-{index}"),
                key.to_string(),
                Some("Use the runtime-provided approval amendment.".to_string()),
            );
        }
        (format!("decision-{index}"), "Approve".to_string(), None)
    } else {
        (format!("decision-{index}"), "Approve".to_string(), None)
    }
}

fn build_codex_approval_description(reason: Option<String>, cwd: Option<String>) -> Option<String> {
    let mut parts = Vec::new();
    if let Some(reason) = reason.filter(|value| !value.trim().is_empty()) {
        parts.push(reason);
    }
    if let Some(cwd) = cwd.filter(|value| !value.trim().is_empty()) {
        parts.push(format!("cwd: {cwd}"));
    }
    if parts.is_empty() {
        None
    } else {
        Some(parts.join("\n"))
    }
}

fn map_codex_user_input_question(question: &Value) -> AgentRequestQuestion {
    AgentRequestQuestion {
        id: question
            .get("id")
            .and_then(Value::as_str)
            .unwrap_or("question")
            .to_string(),
        header: question
            .get("header")
            .and_then(Value::as_str)
            .unwrap_or("Question")
            .to_string(),
        question: question
            .get("question")
            .and_then(Value::as_str)
            .unwrap_or("Provide input.")
            .to_string(),
        is_other: question
            .get("isOther")
            .and_then(Value::as_bool)
            .unwrap_or(false),
        is_secret: question
            .get("isSecret")
            .and_then(Value::as_bool)
            .unwrap_or(false),
        options: question.get("options").and_then(Value::as_array).map(|options| {
            options
                .iter()
                .enumerate()
                .map(|(index, option)| AgentRequestOption {
                    id: format!(
                        "{}-option-{index}",
                        question
                            .get("id")
                            .and_then(Value::as_str)
                            .unwrap_or("question")
                    ),
                    label: option
                        .get("label")
                        .and_then(Value::as_str)
                        .unwrap_or("Option")
                        .to_string(),
                    description: option
                        .get("description")
                        .and_then(Value::as_str)
                        .map(str::to_string),
                })
                .collect()
        }),
    }
}

fn classify_codex_app_server_stderr(stderr_output: &str) -> Option<String> {
    let trimmed = stderr_output.trim();
    if trimmed.is_empty() {
        return None;
    }
    Some(format!("Codex App Server stderr: {trimmed}"))
}

fn read_codex_attachment_data_url(
    session_id: &str,
    attachment: &AgentAttachment,
) -> Result<String, String> {
    let attachment_path = resolve_staged_attachment_path(session_id, &attachment.id)?;
    let bytes = fs::read(&attachment_path)
        .map_err(|error| format!("Failed to read staged Codex attachment: {error}"))?;
    Ok(format!(
        "data:{};base64,{}",
        attachment.mime_type,
        BASE64_STANDARD.encode(bytes),
    ))
}

fn read_codex_route_item_id(params: &Value) -> Option<String> {
    params
        .get("itemId")
        .and_then(Value::as_str)
        .or_else(|| params.get("item_id").and_then(Value::as_str))
        .or_else(|| {
            params
                .get("item")
                .and_then(|item| item.get("id"))
                .and_then(Value::as_str)
        })
        .map(str::to_string)
}
