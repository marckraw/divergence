use super::provider_registry::build_gemini_command;
use super::{
    AgentAttachment, AgentMessageStatus, AgentRuntimeState, AgentRuntimeStatus,
    AgentSessionSnapshot, AgentSessionStatus, AgentTurnInvocation, ProviderOutputChunk,
    RunningSessionHandle, RunningTransport, append_assistant_paragraph, append_assistant_text,
    last_assistant_message_mut, now_ms, push_runtime_event, read_provider_text_delta,
    read_provider_thread_id, resolve_staged_attachment_path, session_attachment_dir,
    split_provider_output_chunks, truncate_details,
};
use serde_json::Value;
use std::path::PathBuf;
use std::process::Stdio;
use std::sync::Arc;
use tauri::AppHandle;
use tokio::io::{AsyncBufReadExt, AsyncReadExt, BufReader};
use tokio::sync::Mutex as AsyncMutex;

#[derive(Debug, Clone, PartialEq, Eq)]
struct GeminiCliFailure {
    user_message: String,
    debug_details: Option<String>,
}

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
            let failure = classify_gemini_cli_failure(exit_code, &stderr_output);
            if failure.debug_details.is_some() {
                let snapshot = self.mutate_session(session_id, |session| {
                    push_runtime_event(
                        session,
                        "Provider failure",
                        &failure.user_message,
                        failure.debug_details.clone(),
                    );
                    session.updated_at_ms = now_ms();
                    Ok(())
                })?;
                self.emit_snapshot_update(app, &snapshot);
            }
            return Err(failure.user_message);
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
        let event_type = value
            .get("type")
            .and_then(Value::as_str)
            .unwrap_or_default();
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
                let role = value
                    .get("role")
                    .and_then(Value::as_str)
                    .unwrap_or_default();
                if role == "assistant" {
                    if let Some(text) = read_provider_text_delta(&value) {
                        let is_delta = value.get("delta").and_then(Value::as_bool).unwrap_or(false);
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

fn classify_gemini_cli_failure(exit_code: i32, stderr_output: &str) -> GeminiCliFailure {
    let trimmed = stderr_output.trim();
    let lowercase = trimmed.to_ascii_lowercase();
    let debug_details = (!trimmed.is_empty()).then(|| truncate_details(trimmed));

    if lowercase.contains("resource_exhausted")
        || lowercase.contains("rate limit")
        || lowercase.contains("quota")
        || lowercase.contains("429")
    {
        let retry_hint = extract_gemini_retry_delay(trimmed)
            .map(|delay| format!(" Retry in about {delay}."))
            .unwrap_or_else(|| " Retry after a short wait.".to_string());
        return GeminiCliFailure {
            user_message: format!(
                "Gemini hit a rate limit before it produced a response.{retry_hint} You can also switch models or accounts and try again."
            ),
            debug_details,
        };
    }

    if lowercase.contains("unauthenticated")
        || lowercase.contains("auth")
        || lowercase.contains("login")
        || lowercase.contains("credential")
        || lowercase.contains("permission_denied")
        || lowercase.contains("api key not valid")
    {
        return GeminiCliFailure {
            user_message: "Gemini CLI is not authenticated. Run the Gemini login/setup flow, then try again."
                .to_string(),
            debug_details,
        };
    }

    if lowercase.contains("not found")
        || lowercase.contains("enoent")
        || lowercase.contains("command not found")
        || lowercase.contains("no such file")
        || lowercase.contains("failed to spawn")
    {
        return GeminiCliFailure {
            user_message:
                "Gemini CLI is not available in this environment. Check the Gemini installation/setup and try again."
                    .to_string(),
            debug_details,
        };
    }

    GeminiCliFailure {
        user_message: format!(
            "Gemini CLI failed before it produced a response (exit code {exit_code}). Check Runtime Debug for provider details."
        ),
        debug_details,
    }
}

fn extract_gemini_retry_delay(stderr_output: &str) -> Option<String> {
    for marker in ["retryDelay", "retry_delay"] {
        let Some(index) = stderr_output.find(marker) else {
            continue;
        };
        let suffix = &stderr_output[index + marker.len()..];
        if let Some(delay) = extract_delay_token(suffix) {
            return Some(delay);
        }
    }

    None
}

fn extract_delay_token(input: &str) -> Option<String> {
    let bytes = input.as_bytes();
    let mut start = None;

    for (index, byte) in bytes.iter().enumerate() {
        let is_digit = byte.is_ascii_digit();
        if start.is_none() {
            if is_digit {
                start = Some(index);
            }
            continue;
        }

        if is_digit || *byte == b'.' {
            continue;
        }

        let unit_start = index;
        let mut unit_end = index;
        while unit_end < bytes.len()
            && (bytes[unit_end] as char).is_ascii_alphabetic()
        {
            unit_end += 1;
        }

        if unit_end > unit_start {
            let start = start?;
            return Some(input[start..unit_end].trim_matches(|char: char| {
                char == '"' || char == '\'' || char == ':' || char.is_whitespace()
            }).to_string());
        }

        break;
    }

    None
}

#[cfg(test)]
mod tests {
    use super::{classify_gemini_cli_failure, extract_gemini_retry_delay};

    #[test]
    fn classifies_rate_limit_failures_without_leaking_raw_stderr() {
        let failure = classify_gemini_cli_failure(
            1,
            r#"Error: RESOURCE_EXHAUSTED: 429 quota exceeded {"retryDelay":"52s"} at /Users/test/node_modules/foo/index.js:12:34"#,
        );

        assert_eq!(
            failure.user_message,
            "Gemini hit a rate limit before it produced a response. Retry in about 52s. You can also switch models or accounts and try again."
        );
        assert!(failure.debug_details.as_deref().is_some_and(|details| details.contains("RESOURCE_EXHAUSTED")));
        assert!(!failure.user_message.contains("/Users/test"));
    }

    #[test]
    fn extracts_retry_delay_from_gemini_stderr() {
        assert_eq!(
            extract_gemini_retry_delay(r#"blah "retryDelay":"52s" more blah"#).as_deref(),
            Some("52s")
        );
        assert_eq!(
            extract_gemini_retry_delay(r#"blah retry_delay: 1.5s more blah"#).as_deref(),
            Some("1.5s")
        );
    }

    #[test]
    fn classifies_auth_failures() {
        let failure = classify_gemini_cli_failure(
            1,
            "UNAUTHENTICATED: please login to Gemini CLI before continuing",
        );

        assert_eq!(
            failure.user_message,
            "Gemini CLI is not authenticated. Run the Gemini login/setup flow, then try again."
        );
    }

    #[test]
    fn falls_back_to_generic_provider_failure_message() {
        let failure = classify_gemini_cli_failure(17, "Unhandled provider transport failure");

        assert_eq!(
            failure.user_message,
            "Gemini CLI failed before it produced a response (exit code 17). Check Runtime Debug for provider details."
        );
    }
}
