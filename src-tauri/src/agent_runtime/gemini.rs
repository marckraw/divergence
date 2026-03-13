use super::provider_registry::build_gemini_command;
use super::*;

impl AgentRuntimeState {
    pub(super) async fn run_gemini_turn_process(
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
            "Starting Gemini CLI.",
            Some(session.model.clone()),
        )?;
        let attachment_paths = resolve_gemini_attachment_paths(session_id, &turn.attachments)?;
        let attachment_dirs = if attachment_paths.is_empty() {
            Vec::new()
        } else {
            vec![session_attachment_dir(session_id)]
        };
        let prompt_with_attachments = build_gemini_prompt(&turn.prompt, &attachment_paths);
        let mut command = build_gemini_command(
            session,
            &prompt_with_attachments,
            turn.interaction_mode,
            &attachment_dirs,
        )?;
        command
            .current_dir(&session.path)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());

        let mut child = command
            .spawn()
            .map_err(|error| format!("Failed to spawn Gemini CLI: {error}"))?;

        let stdout = child
            .stdout
            .take()
            .ok_or_else(|| "Gemini stdout stream was not available.".to_string())?;
        let stderr = child
            .stderr
            .take()
            .ok_or_else(|| "Gemini stderr stream was not available.".to_string())?;

        let child = Arc::new(AsyncMutex::new(child));
        self.register_running_session(
            session_id,
            RunningSessionHandle {
                child: child.clone(),
                transport: RunningTransport::Gemini,
            },
        )?;
        self.emit_runtime_event(
            app,
            session_id,
            "Waiting for model",
            "Gemini process started. Waiting for streamed output.",
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
            .map_err(|error| format!("Failed reading Gemini output: {error}"))?
        {
            self.handle_gemini_output_line(app, session_id, &line)?;
        }

        let status = {
            let mut child = child.lock().await;
            child
                .wait()
                .await
                .map_err(|error| format!("Failed waiting for Gemini process: {error}"))?
        };

        let stderr_output = stderr_task
            .await
            .map_err(|error| format!("Failed collecting Gemini stderr: {error}"))?;

        if self.is_session_stopping(session_id) {
            return Ok(());
        }

        if !status.success() {
            let exit_code = status.code().unwrap_or_default();
            let message = if stderr_output.trim().is_empty() {
                format!("Gemini CLI exited with code {exit_code}.")
            } else {
                format!("Gemini CLI exited with code {exit_code}: {}", stderr_output.trim())
            };
            return Err(message);
        }

        let snapshot = self.mutate_session(session_id, |current_session| {
            if let Some(message) = last_assistant_message_mut(current_session) {
                if matches!(message.status, AgentMessageStatus::Streaming) {
                    message.status = AgentMessageStatus::Done;
                }
            }
            current_session.status = AgentSessionStatus::Active;
            current_session.runtime_status = AgentRuntimeStatus::Idle;
            push_runtime_event(
                current_session,
                "Completed",
                "Gemini completed the turn.",
                None,
            );
            current_session.updated_at_ms = now_ms();
            Ok(())
        })?;
        self.emit_snapshot_update(app, &snapshot);

        Ok(())
    }

    fn handle_gemini_output_line(
        &self,
        app: &AppHandle,
        session_id: &str,
        line: &str,
    ) -> Result<(), String> {
        let trimmed = line.trim_end();
        if trimmed.is_empty() {
            return Ok(());
        }

        let output_chunks = split_provider_output_chunks(trimmed);
        if output_chunks
            .iter()
            .any(|chunk| matches!(chunk, ProviderOutputChunk::Json(_)))
        {
            for chunk in output_chunks {
                match chunk {
                    ProviderOutputChunk::Json(value) => {
                        self.handle_gemini_output_value(app, session_id, value)?;
                    }
                    ProviderOutputChunk::Text(text) => {
                        let snapshot = self.mutate_session(session_id, |session| {
                            push_runtime_event(
                                session,
                                "Provider notice",
                                "Gemini emitted a provider notice.",
                                Some(truncate_details(&text)),
                            );
                            session.updated_at_ms = now_ms();
                            Ok(())
                        })?;
                        self.emit_snapshot_update(app, &snapshot);
                    }
                }
            }
            return Ok(());
        }

        let snapshot = self.mutate_session(session_id, |session| {
            let delta = if let Some(message) = last_assistant_message_mut(session) {
                if message.content.is_empty() {
                    trimmed.to_string()
                } else {
                    format!("\n{trimmed}")
                }
            } else {
                trimmed.to_string()
            };
            append_assistant_text(session, None, &delta);
            push_runtime_event(
                session,
                "Streaming response",
                "Received Gemini response text.",
                None,
            );
            session.updated_at_ms = now_ms();
            Ok(())
        })?;
        self.emit_snapshot_update(app, &snapshot);
        Ok(())
    }

    fn handle_gemini_output_value(
        &self,
        app: &AppHandle,
        session_id: &str,
        value: Value,
    ) -> Result<(), String> {
        let event_type = value.get("type").and_then(Value::as_str).unwrap_or_default();
        match event_type {
            "init" => {
                if let Some(thread_id) = read_provider_thread_id(&value) {
                    let snapshot = self.mutate_session(session_id, |session| {
                        session.thread_id = Some(thread_id);
                        push_runtime_event(
                            session,
                            "Preparing turn",
                            "Gemini session is ready.",
                            None,
                        );
                        session.updated_at_ms = now_ms();
                        Ok(())
                    })?;
                    self.emit_snapshot_update(app, &snapshot);
                }
            }
            "message" => {
                let role = value.get("role").and_then(Value::as_str).unwrap_or_default();
                if role == "assistant" {
                    if let Some(text) = read_provider_text_delta(&value) {
                        let is_delta =
                            value.get("delta").and_then(Value::as_bool).unwrap_or(false);
                        let snapshot = self.mutate_session(session_id, |session| {
                            if is_delta {
                                append_assistant_text(session, None, &text);
                            } else {
                                append_assistant_paragraph(session, None, &text);
                            }
                            push_runtime_event(
                                session,
                                "Streaming response",
                                "Received Gemini response text.",
                                None,
                            );
                            session.updated_at_ms = now_ms();
                            Ok(())
                        })?;
                        self.emit_snapshot_update(app, &snapshot);
                    }
                }
            }
            "result" => {}
            _ => {
                if let Some(text) = read_provider_text_delta(&value) {
                    let snapshot = self.mutate_session(session_id, |session| {
                        append_assistant_text(session, None, &text);
                        push_runtime_event(
                            session,
                            "Streaming response",
                            "Received Gemini response text.",
                            None,
                        );
                        session.updated_at_ms = now_ms();
                        Ok(())
                    })?;
                    self.emit_snapshot_update(app, &snapshot);
                }
            }
        }

        Ok(())
    }
}

fn resolve_gemini_attachment_paths(
    session_id: &str,
    attachments: &[AgentAttachment],
) -> Result<Vec<PathBuf>, String> {
    attachments
        .iter()
        .map(|attachment| resolve_staged_attachment_path(session_id, &attachment.id))
        .collect()
}

fn build_gemini_prompt(prompt: &str, attachment_paths: &[PathBuf]) -> String {
    if attachment_paths.is_empty() {
        return prompt.to_string();
    }

    let attachment_directives = attachment_paths
        .iter()
        .map(|path| format!("@{}", path.to_string_lossy()))
        .collect::<Vec<_>>()
        .join("\n");

    if prompt.trim().is_empty() {
        attachment_directives
    } else {
        format!("{attachment_directives}\n\n{}", prompt.trim())
    }
}
