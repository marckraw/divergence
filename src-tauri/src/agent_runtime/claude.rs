use super::provider_registry::build_claude_command;
use super::*;

impl AgentRuntimeState {
    pub(super) async fn run_claude_turn_process(
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
            "Starting Claude Code CLI.",
            Some(session.model.clone()),
        )?;
        let attachment_paths = resolve_attachment_paths(session_id, &turn.attachments)?;
        let attachment_dirs = if attachment_paths.is_empty() {
            Vec::new()
        } else {
            vec![session_attachment_dir(session_id)]
        };
        let prompt_with_attachments = build_claude_prompt(&turn.prompt, &attachment_paths);
        let mut command = build_claude_command(
            session,
            turn.interaction_mode,
            &turn.claude_oauth_token,
            &attachment_dirs,
        );
        command
            .current_dir(&session.path)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());

        let mut child = command
            .spawn()
            .map_err(|error| format!("Failed to spawn Claude process: {error}"))?;

        if let Some(mut stdin) = child.stdin.take() {
            stdin
                .write_all(prompt_with_attachments.as_bytes())
                .await
                .map_err(|error| format!("Failed to write Claude prompt: {error}"))?;
            stdin
                .write_all(b"\n")
                .await
                .map_err(|error| format!("Failed to finalize Claude prompt: {error}"))?;
        }

        let stdout = child
            .stdout
            .take()
            .ok_or_else(|| "Claude stdout stream was not available.".to_string())?;
        let stderr = child
            .stderr
            .take()
            .ok_or_else(|| "Claude stderr stream was not available.".to_string())?;

        let child = Arc::new(AsyncMutex::new(child));
        self.register_running_session(
            session_id,
            RunningSessionHandle {
                child: child.clone(),
                transport: RunningTransport::Claude,
            },
        )?;
        self.emit_runtime_event(
            app,
            session_id,
            "Waiting for model",
            "Claude process started. Waiting for streamed output.",
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
            .map_err(|error| format!("Failed reading Claude output: {error}"))?
        {
            self.handle_claude_output_line(app, session_id, &line)?;
        }

        let status = {
            let mut child = child.lock().await;
            child
                .wait()
                .await
                .map_err(|error| format!("Failed waiting for Claude process: {error}"))?
        };

        let stderr_output = stderr_task
            .await
            .map_err(|error| format!("Failed collecting Claude stderr: {error}"))?;

        if self.is_session_stopping(session_id) {
            return Ok(());
        }

        if !status.success() {
            let exit_code = status.code().unwrap_or_default();
            let message = if stderr_output.trim().is_empty() {
                format!("Claude process exited with code {exit_code}.")
            } else {
                format!(
                    "Claude process exited with code {exit_code}: {}",
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
                "Claude completed the turn.",
                None,
            );
            current_session.updated_at_ms = now_ms();
            Ok(())
        })?;
        self.emit_snapshot_update(app, &snapshot);

        Ok(())
    }

    fn handle_claude_output_line(
        &self,
        app: &AppHandle,
        session_id: &str,
        line: &str,
    ) -> Result<(), String> {
        let parsed: Value = match serde_json::from_str(line) {
            Ok(value) => value,
            Err(_) => {
                return Ok(());
            }
        };

        self.handle_claude_output(app, session_id, parsed)
    }

    fn handle_claude_output(
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
                let session_identifier = parsed
                    .get("session_id")
                    .and_then(Value::as_str)
                    .map(str::to_string);
                if let Some(thread_id) = session_identifier {
                    let snapshot = self.mutate_session(session_id, |session| {
                        session.thread_id = Some(thread_id);
                        push_runtime_event(
                            session,
                            "Preparing turn",
                            "Claude session is ready.",
                            None,
                        );
                        session.updated_at_ms = now_ms();
                        Ok(())
                    })?;
                    self.emit_snapshot_update(app, &snapshot);
                }
            }
            "stream_event" => {
                let event = parsed.get("event").cloned().unwrap_or(Value::Null);
                let stream_type = event
                    .get("type")
                    .and_then(Value::as_str)
                    .unwrap_or_default();
                if stream_type == "content_block_delta" {
                    let delta = event.get("delta").cloned().unwrap_or(Value::Null);
                    let delta_type = delta
                        .get("type")
                        .and_then(Value::as_str)
                        .unwrap_or_default();
                    if delta_type == "text_delta" {
                        let text = delta
                            .get("text")
                            .and_then(Value::as_str)
                            .unwrap_or_default();
                        if !text.is_empty() {
                            let snapshot = self.mutate_session(session_id, |session| {
                                append_assistant_text(session, None, text);
                                push_runtime_event(
                                    session,
                                    "Streaming response",
                                    "Received Claude response text.",
                                    None,
                                );
                                session.updated_at_ms = now_ms();
                                Ok(())
                            })?;
                            self.emit_snapshot_update(app, &snapshot);
                        }
                    }
                }
            }
            "assistant" => {
                let message = parsed.get("message").cloned().unwrap_or(Value::Null);
                let contents = message
                    .get("content")
                    .and_then(Value::as_array)
                    .cloned()
                    .unwrap_or_default();

                for content in contents {
                    let content_type = content
                        .get("type")
                        .and_then(Value::as_str)
                        .unwrap_or_default();

                    if content_type == "tool_use" {
                        let activity_id = content
                            .get("id")
                            .and_then(Value::as_str)
                            .map(str::to_string)
                            .unwrap_or_else(|| format!("activity-{}", Uuid::new_v4()));
                        let raw_tool_name = content
                            .get("name")
                            .and_then(Value::as_str)
                            .unwrap_or("Tool");
                        let input_value = content.get("input");

                        let is_skill = raw_tool_name.eq_ignore_ascii_case("skill");
                        let skill_name = if is_skill {
                            input_value
                                .and_then(|input| input.get("skill"))
                                .and_then(Value::as_str)
                                .map(str::to_string)
                        } else {
                            None
                        };

                        let (activity_kind, tool_name) = if is_skill {
                            (
                                "skill".to_string(),
                                skill_name
                                    .clone()
                                    .map(|name| format!("/{name}"))
                                    .unwrap_or_else(|| "Skill".to_string()),
                            )
                        } else {
                            ("tool".to_string(), raw_tool_name.to_string())
                        };
                        let details = input_value.map(truncate_json_details);

                        let snapshot = self.mutate_session(session_id, |session| {
                            if !session.activities.iter().any(|item| item.id == activity_id) {
                                session.activities.push(create_activity(
                                    activity_id.clone(),
                                    activity_kind.clone(),
                                    tool_name.clone(),
                                    AgentActivityStatus::Running,
                                    details,
                                    now_ms(),
                                    None,
                                ));
                            }
                            push_runtime_event(
                                session,
                                if is_skill { "Running skill" } else { "Running tool" },
                                if is_skill {
                                    "Claude started a skill invocation."
                                } else {
                                    "Claude started a tool call."
                                },
                                Some(tool_name.clone()),
                            );
                            session.updated_at_ms = now_ms();
                            Ok(())
                        })?;
                        self.emit_snapshot_update(app, &snapshot);
                    }
                }
            }
            "user" => {
                let tool_results = parsed
                    .get("message")
                    .and_then(|message| message.get("content"))
                    .and_then(Value::as_array)
                    .cloned()
                    .unwrap_or_default();

                for tool_result in tool_results {
                    let tool_use_id = tool_result
                        .get("tool_use_id")
                        .and_then(Value::as_str)
                        .map(str::to_string);
                    if let Some(activity_id) = tool_use_id {
                        let details = tool_result
                            .get("content")
                            .and_then(Value::as_str)
                            .map(truncate_details);
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
                                "Claude finished a tool call.",
                                None,
                            );
                            session.updated_at_ms = now_ms();
                            Ok(())
                        })?;
                        self.emit_snapshot_update(app, &snapshot);
                    }
                }
            }
            "result" => {
                let session_identifier = parsed
                    .get("session_id")
                    .and_then(Value::as_str)
                    .map(str::to_string);
                let result = parsed
                    .get("result")
                    .and_then(Value::as_str)
                    .unwrap_or_default()
                    .to_string();
                let is_error = parsed
                    .get("is_error")
                    .and_then(Value::as_bool)
                    .unwrap_or(false);

                let snapshot = self.mutate_session(session_id, |session| {
                    if let Some(thread_id) = session_identifier {
                        session.thread_id = Some(thread_id);
                    }
                    if let Some(message) = last_assistant_message_mut(session) {
                        if message.content.trim().is_empty() && !result.trim().is_empty() {
                            message.content = result.clone();
                        }
                        message.status = if is_error {
                            AgentMessageStatus::Error
                        } else {
                            AgentMessageStatus::Done
                        };
                    }
                    session.status = if is_error {
                        AgentSessionStatus::Idle
                    } else {
                        AgentSessionStatus::Active
                    };
                    session.runtime_status = if is_error {
                        AgentRuntimeStatus::Error
                    } else {
                        AgentRuntimeStatus::Idle
                    };
                    session.error_message = if is_error { Some(result.clone()) } else { None };
                    push_runtime_event(
                        session,
                        if is_error { "Errored" } else { "Completed" },
                        if is_error {
                            "Claude finished the turn with an error."
                        } else {
                            "Claude finished the turn."
                        },
                        if is_error { Some(result.clone()) } else { None },
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
}

fn resolve_attachment_paths(
    session_id: &str,
    attachments: &[AgentAttachment],
) -> Result<Vec<PathBuf>, String> {
    attachments
        .iter()
        .map(|attachment| resolve_staged_attachment_path(session_id, &attachment.id))
        .collect()
}

fn build_claude_prompt(prompt: &str, attachment_paths: &[PathBuf]) -> String {
    if attachment_paths.is_empty() {
        return prompt.to_string();
    }

    let mut sections = vec![
        "Attached image files:".to_string(),
        attachment_paths
            .iter()
            .map(|path| format!("- {}", path.to_string_lossy()))
            .collect::<Vec<_>>()
            .join("\n"),
        "Use those images as part of your answer.".to_string(),
    ];
    if !prompt.trim().is_empty() {
        sections.push(format!("User prompt:\n{}", prompt.trim()));
    }
    sections.join("\n\n")
}
