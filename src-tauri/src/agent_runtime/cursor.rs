use super::provider_registry::build_cursor_command;
use super::*;

impl AgentRuntimeState {
    pub(super) async fn run_cursor_turn_process(
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
            "Starting Cursor Agent CLI.",
            Some(session.model.clone()),
        )?;
        let mut command = build_cursor_command(session, &turn.prompt, turn.interaction_mode)?;
        command
            .current_dir(&session.path)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());

        let mut child = command
            .spawn()
            .map_err(|error| format!("Failed to spawn Cursor Agent: {error}"))?;

        let stdout = child
            .stdout
            .take()
            .ok_or_else(|| "Cursor stdout stream was not available.".to_string())?;
        let stderr = child
            .stderr
            .take()
            .ok_or_else(|| "Cursor stderr stream was not available.".to_string())?;

        let child = Arc::new(AsyncMutex::new(child));
        self.register_running_session(
            session_id,
            RunningSessionHandle {
                child: child.clone(),
                transport: RunningTransport::Cursor,
            },
        )?;
        self.emit_runtime_event(
            app,
            session_id,
            "Waiting for model",
            "Cursor process started. Waiting for streamed output.",
            None,
        )?;

        let stderr_task = tokio::spawn(async move {
            let mut buffer = Vec::new();
            let mut reader = stderr;
            let _ = reader.read_to_end(&mut buffer).await;
            String::from_utf8_lossy(&buffer).to_string()
        });

        let mut reader = BufReader::new(stdout).lines();
        while let Some(line) = reader
            .next_line()
            .await
            .map_err(|error| format!("Failed reading Cursor output: {error}"))?
        {
            self.handle_cursor_output_line(app, session_id, &line)?;
        }

        let status = {
            let mut child = child.lock().await;
            child
                .wait()
                .await
                .map_err(|error| format!("Failed waiting for Cursor process: {error}"))?
        };

        let stderr_output = stderr_task
            .await
            .map_err(|error| format!("Failed collecting Cursor stderr: {error}"))?;

        if self.is_session_stopping(session_id) {
            return Ok(());
        }

        if !status.success() {
            let exit_code = status.code().unwrap_or_default();
            let message = if stderr_output.trim().is_empty() {
                format!("Cursor Agent exited with code {exit_code}.")
            } else {
                format!(
                    "Cursor Agent exited with code {exit_code}: {}",
                    stderr_output.trim()
                )
            };
            return Err(message);
        }

        let snapshot = self.mutate_session(session_id, |current_session| {
            if let Some(message) = last_assistant_message_mut(current_session) {
                if matches!(message.status, AgentMessageStatus::Streaming) {
                    message.status = AgentMessageStatus::Done;
                }
            }
            upsert_proposed_plan_from_turn(current_session);
            current_session.status = AgentSessionStatus::Active;
            current_session.runtime_status = AgentRuntimeStatus::Idle;
            push_runtime_event(
                current_session,
                "Completed",
                "Cursor completed the turn.",
                None,
            );
            current_session.updated_at_ms = now_ms();
            Ok(())
        })?;
        self.emit_snapshot_update(app, &snapshot);

        Ok(())
    }

    fn handle_cursor_output_line(
        &self,
        app: &AppHandle,
        session_id: &str,
        line: &str,
    ) -> Result<(), String> {
        let parsed: Value = match serde_json::from_str(line) {
            Ok(value) => value,
            Err(_) => return Ok(()),
        };
        self.handle_cursor_output(app, session_id, parsed)
    }

    fn handle_cursor_output(
        &self,
        app: &AppHandle,
        session_id: &str,
        parsed: Value,
    ) -> Result<(), String> {
        let event_type = parsed
            .get("type")
            .and_then(Value::as_str)
            .unwrap_or_default();

        match event_type {
            "system" => {
                if let Some(thread_id) = read_provider_thread_id(&parsed) {
                    let snapshot = self.mutate_session(session_id, |session| {
                        session.thread_id = Some(thread_id);
                        push_runtime_event(
                            session,
                            "Preparing turn",
                            "Cursor session is ready.",
                            None,
                        );
                        session.updated_at_ms = now_ms();
                        Ok(())
                    })?;
                    self.emit_snapshot_update(app, &snapshot);
                }
            }
            "thinking" => {
                let snapshot = self.mutate_session(session_id, |session| {
                    let subtype = parsed
                        .get("subtype")
                        .and_then(Value::as_str)
                        .unwrap_or_default();

                    match subtype {
                        "delta" => {
                            let details = read_provider_text_delta(&parsed)
                                .filter(|text| !text.trim().is_empty())
                                .unwrap_or_default();
                            if details.is_empty() {
                                return Ok(());
                            }

                            if let Some(activity) =
                                session.activities.iter_mut().rev().find(|activity| {
                                    activity.kind == "thought_process"
                                        && activity.title == "Thinking"
                                        && matches!(activity.status, AgentActivityStatus::Running)
                                })
                            {
                                let next_details = match activity.details.as_deref() {
                                    Some(existing) if !existing.is_empty() => {
                                        format!("{existing}{details}")
                                    }
                                    _ => details,
                                };
                                activity.details = Some(truncate_details(&next_details));
                            } else {
                                session.activities.push(create_activity(
                                    format!("cursor-thinking-{}", Uuid::new_v4()),
                                    "thought_process".to_string(),
                                    "Thinking".to_string(),
                                    AgentActivityStatus::Running,
                                    Some(truncate_details(&details)),
                                    now_ms(),
                                    None,
                                ));
                            }
                        }
                        "completed" => {
                            if let Some(activity) =
                                session.activities.iter_mut().rev().find(|activity| {
                                    activity.kind == "thought_process"
                                        && activity.title == "Thinking"
                                        && matches!(activity.status, AgentActivityStatus::Running)
                                })
                            {
                                activity.status = AgentActivityStatus::Completed;
                                activity.completed_at_ms = Some(now_ms());
                            }
                        }
                        _ => {}
                    }

                    push_runtime_event(
                        session,
                        "Thinking",
                        "Cursor emitted thinking output.",
                        None,
                    );
                    session.updated_at_ms = now_ms();
                    Ok(())
                })?;
                self.emit_snapshot_update(app, &snapshot);
            }
            "assistant" | "assistant_message" => {
                if let Some(text) = read_provider_text_delta(&parsed) {
                    let has_timestamp =
                        parsed.get("timestamp_ms").and_then(Value::as_i64).is_some();
                    let snapshot = self.mutate_session(session_id, |session| {
                        let message = ensure_assistant_message(session, None);
                        if has_timestamp {
                            if !matches!(message.status, AgentMessageStatus::Streaming) {
                                message.status = AgentMessageStatus::Streaming;
                            }
                            message.content.push_str(&text);
                        } else {
                            message.content = text;
                            message.status = AgentMessageStatus::Done;
                        }
                        push_runtime_event(
                            session,
                            "Streaming response",
                            "Received Cursor response text.",
                            None,
                        );
                        session.updated_at_ms = now_ms();
                        Ok(())
                    })?;
                    self.emit_snapshot_update(app, &snapshot);
                }
            }
            "tool_call_started" => {
                let activity_id = read_provider_activity_id(&parsed)
                    .unwrap_or_else(|| format!("activity-{}", Uuid::new_v4()));
                let title =
                    read_provider_activity_title(&parsed).unwrap_or_else(|| "Tool".to_string());
                let details = parsed
                    .get("tool_input")
                    .or_else(|| parsed.get("input"))
                    .map(truncate_json_details);
                let snapshot = self.mutate_session(session_id, |session| {
                    let activity_title = title.clone();
                    let activity_details = details.clone();
                    if !session.activities.iter().any(|item| item.id == activity_id) {
                        session.activities.push(create_activity(
                            activity_id.clone(),
                            "tool".to_string(),
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
                        "Cursor started a tool call.",
                        Some(title.clone()),
                    );
                    session.updated_at_ms = now_ms();
                    Ok(())
                })?;
                self.emit_snapshot_update(app, &snapshot);
            }
            "tool_call_completed" => {
                if let Some(activity_id) = read_provider_activity_id(&parsed) {
                    let details =
                        parsed
                            .get("output")
                            .or_else(|| parsed.get("result"))
                            .map(|value| {
                                value
                                    .as_str()
                                    .map(truncate_details)
                                    .unwrap_or_else(|| truncate_json_details(value))
                            });
                    let snapshot = self.mutate_session(session_id, |session| {
                        complete_activity(
                            session,
                            &activity_id,
                            details,
                            AgentActivityStatus::Completed,
                        );
                        push_runtime_event(
                            session,
                            "Tool completed",
                            "Cursor finished a tool call.",
                            None,
                        );
                        session.updated_at_ms = now_ms();
                        Ok(())
                    })?;
                    self.emit_snapshot_update(app, &snapshot);
                }
            }
            "error" => {
                let message = parsed
                    .get("message")
                    .and_then(Value::as_str)
                    .unwrap_or("Cursor Agent failed.")
                    .to_string();
                let snapshot = self.mutate_session(session_id, |session| {
                    if let Some(assistant_message) = last_assistant_message_mut(session) {
                        assistant_message.status = AgentMessageStatus::Error;
                        if assistant_message.content.trim().is_empty() {
                            assistant_message.content = message.clone();
                        }
                    }
                    session.status = AgentSessionStatus::Idle;
                    session.runtime_status = AgentRuntimeStatus::Error;
                    session.error_message = Some(message.clone());
                    push_runtime_event(
                        session,
                        "Errored",
                        "Cursor emitted an error.",
                        Some(message.clone()),
                    );
                    session.updated_at_ms = now_ms();
                    Ok(())
                })?;
                self.emit_snapshot_update(app, &snapshot);
            }
            "result" => {
                if let Some(thread_id) = read_provider_thread_id(&parsed) {
                    let snapshot = self.mutate_session(session_id, |session| {
                        session.thread_id = Some(thread_id);
                        push_runtime_event(
                            session,
                            "Preparing turn",
                            "Cursor returned a result handle.",
                            None,
                        );
                        session.updated_at_ms = now_ms();
                        Ok(())
                    })?;
                    self.emit_snapshot_update(app, &snapshot);
                }
            }
            _ => {}
        }

        Ok(())
    }
}
