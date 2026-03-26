mod activities;
mod attachments;
mod claude;
mod codex;
mod constants;
mod cursor;
mod gemini;
mod messages;
mod opencode;
mod persistence;
mod provider_output;
mod provider_registry;
mod session_updates;
mod state;
pub mod skills;
mod types;

pub use self::state::AgentRuntimeState;
pub use self::types::*;

pub(crate) use self::activities::*;
pub(crate) use self::attachments::*;
pub(crate) use self::constants::*;
pub(crate) use self::messages::*;
pub(crate) use self::provider_output::*;
pub(crate) use self::session_updates::*;
pub(crate) use self::state::{
    PendingRequestTransport, PendingResponseRegistry, PendingResponseSender,
    RunningSessionHandle, RunningTransport, TurnCompletionSignal,
};
pub(crate) use self::types::AgentTurnInvocation;

#[cfg(test)]
mod tests {
    use super::{
        apply_session_failure, complete_activity, create_activity, derive_activity_metadata,
        split_provider_output_chunks, strip_shell_wrapper, AgentActivityStatus, AgentMessage,
        AgentMessageRole, AgentMessageStatus, AgentProvider, AgentRequest, AgentRequestKind,
        AgentRequestStatus, AgentRuntimeDebugEvent, AgentRuntimeState, AgentRuntimeStatus,
        AgentSessionNameMode, AgentSessionRole, AgentSessionSnapshot, AgentSessionStatus,
        AgentTargetType, ProviderOutputChunk, SessionFailureState,
    };
    use serde_json::Value;
    use tokio::time::Duration;

    #[test]
    fn strip_shell_wrapper_removes_common_shell_prefixes() {
        assert_eq!(
            strip_shell_wrapper("/bin/zsh -lc \"sed -n '1,220p' package.json\""),
            "sed -n '1,220p' package.json"
        );
        assert_eq!(
            strip_shell_wrapper("bash -lc 'rg --files src'"),
            "rg --files src"
        );
        assert_eq!(strip_shell_wrapper("pnpm lint"), "pnpm lint");
    }

    #[test]
    fn derive_activity_metadata_treats_bash_as_command() {
        let (summary, subject, group_key) = derive_activity_metadata(
            "tool",
            "Bash",
            Some(r#"{"command":"/bin/zsh -lc \"sed -n '1,220p' package.json\""}"#),
        );

        assert_eq!(summary.as_deref(), Some("Ran sed -n '1,220p' package.json"));
        assert_eq!(subject.as_deref(), Some("sed -n '1,220p' package.json"));
        assert_eq!(group_key.as_deref(), Some("command"));
    }

    #[test]
    fn complete_activity_preserves_existing_summary_metadata() {
        let mut session = AgentSessionSnapshot {
            id: "session-1".to_string(),
            provider: AgentProvider::Claude,
            model: "sonnet".to_string(),
            effort: Some("medium".to_string()),
            target_type: AgentTargetType::Project,
            target_id: 1,
            project_id: 1,
            workspace_owner_id: None,
            workspace_key: "project:1".to_string(),
            session_role: AgentSessionRole::Default,
            name_mode: AgentSessionNameMode::Default,
            name: "Session".to_string(),
            path: "/tmp/project".to_string(),
            status: AgentSessionStatus::Active,
            runtime_status: AgentRuntimeStatus::Running,
            is_open: true,
            created_at_ms: 1,
            updated_at_ms: 1,
            thread_id: None,
            current_turn_started_at_ms: None,
            last_runtime_event_at_ms: None,
            runtime_phase: None,
            conversation_context: None,
            runtime_events: Vec::<AgentRuntimeDebugEvent>::new(),
            messages: Vec::<AgentMessage>::new(),
            activities: vec![create_activity(
                "activity-1".to_string(),
                "tool".to_string(),
                "Bash".to_string(),
                AgentActivityStatus::Running,
                Some(r#"{"command":"ls apps"}"#.to_string()),
                1,
                None,
            )],
            pending_request: Option::<AgentRequest>::None,
            error_message: None,
        };

        complete_activity(
            &mut session,
            "activity-1",
            Some("/tmp/project/apps\n/tmp/project/apps/api".to_string()),
            AgentActivityStatus::Completed,
        );

        let activity = &session.activities[0];
        assert_eq!(activity.summary.as_deref(), Some("Ran ls apps"));
        assert_eq!(activity.group_key.as_deref(), Some("command"));
        assert_eq!(
            activity.details.as_deref(),
            Some("/tmp/project/apps\n/tmp/project/apps/api")
        );
    }

    #[test]
    fn split_provider_output_chunks_extracts_inline_json_objects() {
        let chunks = split_provider_output_chunks(
            r#"MCP issues detected. Run /mcp list for status.{"type":"init","session_id":"session-123"}Hello! How can I help you today?"#,
        );

        assert_eq!(chunks.len(), 3);
        match &chunks[0] {
            ProviderOutputChunk::Text(text) => {
                assert_eq!(text, "MCP issues detected. Run /mcp list for status.");
            }
            ProviderOutputChunk::Json(_) => panic!("expected provider notice text chunk"),
        }
        match &chunks[1] {
            ProviderOutputChunk::Json(value) => {
                assert_eq!(value.get("type").and_then(Value::as_str), Some("init"));
                assert_eq!(
                    value.get("session_id").and_then(Value::as_str),
                    Some("session-123")
                );
            }
            ProviderOutputChunk::Text(_) => panic!("expected structured JSON chunk"),
        }
        match &chunks[2] {
            ProviderOutputChunk::Text(text) => {
                assert_eq!(text, "Hello! How can I help you today?");
            }
            ProviderOutputChunk::Json(_) => panic!("expected trailing assistant text chunk"),
        }
    }
    fn make_test_session(
        session_id: &str,
        pending_request: Option<AgentRequest>,
    ) -> AgentSessionSnapshot {
        AgentSessionSnapshot {
            id: session_id.to_string(),
            provider: AgentProvider::Codex,
            model: "gpt-5.4".to_string(),
            effort: Some("medium".to_string()),
            target_type: AgentTargetType::Project,
            target_id: 1,
            project_id: 1,
            workspace_owner_id: None,
            workspace_key: "project:1".to_string(),
            session_role: AgentSessionRole::Default,
            name_mode: AgentSessionNameMode::Default,
            name: "Session".to_string(),
            path: "/tmp/project".to_string(),
            status: AgentSessionStatus::Busy,
            runtime_status: AgentRuntimeStatus::Waiting,
            is_open: true,
            created_at_ms: 1,
            updated_at_ms: 1,
            thread_id: None,
            current_turn_started_at_ms: None,
            last_runtime_event_at_ms: None,
            runtime_phase: None,
            conversation_context: None,
            runtime_events: Vec::<AgentRuntimeDebugEvent>::new(),
            messages: Vec::<AgentMessage>::new(),
            activities: Vec::new(),
            pending_request,
            error_message: None,
        }
    }

    #[tokio::test]
    async fn wait_for_pending_request_resolution_returns_immediately_without_pending_request() {
        let runtime = AgentRuntimeState::default();
        let session_id = "session-1";
        runtime
            .inner
            .sessions
            .lock()
            .expect("sessions lock")
            .insert(session_id.to_string(), make_test_session(session_id, None));

        runtime
            .wait_for_pending_request_resolution(session_id)
            .await
            .expect("wait should succeed");
        assert!(!runtime
            .session_has_pending_request(session_id)
            .expect("pending request state"));
    }

    #[tokio::test]
    async fn wait_for_pending_request_resolution_blocks_until_request_clears() {
        let runtime = AgentRuntimeState::default();
        let session_id = "session-2";
        runtime
            .inner
            .sessions
            .lock()
            .expect("sessions lock")
            .insert(
                session_id.to_string(),
                make_test_session(
                    session_id,
                    Some(AgentRequest {
                        id: "request-1".to_string(),
                        kind: AgentRequestKind::Approval,
                        title: "Approve tool".to_string(),
                        description: None,
                        options: None,
                        questions: None,
                        status: AgentRequestStatus::Open,
                        opened_at_ms: 1,
                        resolved_at_ms: None,
                    }),
                ),
            );

        let runtime_for_clear = runtime.clone();
        let session_id_for_clear = session_id.to_string();
        tokio::spawn(async move {
            tokio::time::sleep(Duration::from_millis(10)).await;
            runtime_for_clear
                .mutate_session(&session_id_for_clear, |session| {
                    session.pending_request = None;
                    Ok(())
                })
                .expect("clear pending request");
        });

        runtime
            .wait_for_pending_request_resolution(session_id)
            .await
            .expect("wait should succeed");
        assert!(!runtime
            .session_has_pending_request(session_id)
            .expect("pending request state"));
    }

    #[test]
    fn apply_session_failure_populates_empty_assistant_message_with_sanitized_error() {
        let mut session = make_test_session("session-3", None);
        session.messages.push(AgentMessage {
            id: "message-1".to_string(),
            role: AgentMessageRole::Assistant,
            content: String::new(),
            status: AgentMessageStatus::Streaming,
            created_at_ms: 1,
            interaction_mode: None,
            attachments: None,
        });

        apply_session_failure(
            &mut session,
            SessionFailureState {
                message: "Gemini hit a rate limit before it produced a response.",
                details: Some("RESOURCE_EXHAUSTED: 429 ...".to_string()),
            },
        );

        let message = session.messages.last().expect("assistant message");
        assert_eq!(message.status, AgentMessageStatus::Error);
        assert_eq!(
            message.content,
            "Gemini hit a rate limit before it produced a response."
        );
        assert_eq!(
            session.error_message.as_deref(),
            Some("Gemini hit a rate limit before it produced a response.")
        );
        assert_eq!(session.runtime_status, AgentRuntimeStatus::Error);
        assert!(session
            .runtime_events
            .last()
            .and_then(|event| event.details.as_deref())
            .is_some_and(|details| details.contains("RESOURCE_EXHAUSTED")));
    }

    #[test]
    fn apply_session_failure_preserves_partial_assistant_output() {
        let mut session = make_test_session("session-4", None);
        session.messages.push(AgentMessage {
            id: "message-1".to_string(),
            role: AgentMessageRole::Assistant,
            content: "Partial streamed answer".to_string(),
            status: AgentMessageStatus::Streaming,
            created_at_ms: 1,
            interaction_mode: None,
            attachments: None,
        });

        apply_session_failure(
            &mut session,
            SessionFailureState {
                message: "Gemini CLI failed before it produced a response (exit code 17). Check Runtime Debug for provider details.",
                details: Some("stack trace".to_string()),
            },
        );

        let message = session.messages.last().expect("assistant message");
        assert_eq!(message.status, AgentMessageStatus::Error);
        assert_eq!(message.content, "Partial streamed answer");
        assert_eq!(
            session.error_message.as_deref(),
            Some("Gemini CLI failed before it produced a response (exit code 17). Check Runtime Debug for provider details.")
        );
    }
}
