use super::activities::now_ms;
use super::constants::MAX_RUNTIME_EVENTS;
use super::messages::last_assistant_message_mut;
use super::provider_registry::provider_descriptors;
use super::types::{
    AgentMessageRole, AgentMessageStatus, AgentRuntimeCapabilities, AgentRuntimeDebugEvent,
    AgentRuntimeStatus, AgentSessionSnapshot, AgentSessionStatus, AgentSessionSummary,
};
use uuid::Uuid;

#[derive(Debug, Clone)]
pub(crate) struct SessionFailureState<'a> {
    pub(crate) message: &'a str,
    pub(crate) details: Option<String>,
}

pub(crate) fn summarize_session(session: &AgentSessionSnapshot) -> AgentSessionSummary {
    let latest_assistant_message = session
        .messages
        .iter()
        .rev()
        .find(|message| matches!(message.role, AgentMessageRole::Assistant));

    AgentSessionSummary {
        id: session.id.clone(),
        provider: session.provider.clone(),
        model: session.model.clone(),
        effort: session.effort.clone(),
        target_type: session.target_type,
        target_id: session.target_id,
        project_id: session.project_id,
        workspace_owner_id: session.workspace_owner_id,
        workspace_key: session.workspace_key.clone(),
        session_role: session.session_role,
        name_mode: session.name_mode,
        name: session.name.clone(),
        path: session.path.clone(),
        status: session.status,
        runtime_status: session.runtime_status,
        is_open: session.is_open,
        created_at_ms: session.created_at_ms,
        updated_at_ms: session.updated_at_ms,
        thread_id: session.thread_id.clone(),
        current_turn_started_at_ms: session.current_turn_started_at_ms,
        last_runtime_event_at_ms: session.last_runtime_event_at_ms,
        runtime_phase: session.runtime_phase.clone(),
        pending_request: session.pending_request.clone(),
        error_message: session.error_message.clone(),
        latest_assistant_message_interaction_mode: latest_assistant_message
            .and_then(|message| message.interaction_mode),
        latest_assistant_message_status: latest_assistant_message.map(|message| message.status),
    }
}

pub(crate) fn build_capabilities() -> AgentRuntimeCapabilities {
    AgentRuntimeCapabilities {
        placeholder_sessions_supported: false,
        live_streaming_supported: true,
        persistent_snapshots_supported: true,
        providers: provider_descriptors(),
    }
}

pub(crate) fn push_runtime_event(
    session: &mut AgentSessionSnapshot,
    phase: &str,
    message: &str,
    details: Option<String>,
) {
    let at_ms = now_ms();
    session.runtime_phase = Some(phase.to_string());
    session.last_runtime_event_at_ms = Some(at_ms);
    session.updated_at_ms = at_ms;
    if let Some(last_event) = session.runtime_events.last_mut() {
        if last_event.phase == phase && last_event.message == message {
            last_event.at_ms = at_ms;
            if details.is_some() {
                last_event.details = details;
            }
            return;
        }
    }
    session.runtime_events.push(AgentRuntimeDebugEvent {
        id: format!("runtime-event-{}", Uuid::new_v4()),
        at_ms,
        phase: phase.to_string(),
        message: message.to_string(),
        details,
    });
    if session.runtime_events.len() > MAX_RUNTIME_EVENTS {
        let overflow = session.runtime_events.len() - MAX_RUNTIME_EVENTS;
        session.runtime_events.drain(0..overflow);
    }
}

pub(crate) fn apply_session_failure(
    session: &mut AgentSessionSnapshot,
    failure: SessionFailureState<'_>,
) {
    if let Some(message) = last_assistant_message_mut(session) {
        message.status = AgentMessageStatus::Error;
        if message.content.trim().is_empty() {
            message.content = failure.message.to_string();
        }
    }
    session.status = AgentSessionStatus::Idle;
    session.runtime_status = AgentRuntimeStatus::Error;
    session.updated_at_ms = now_ms();
    session.runtime_phase = Some("Errored".to_string());
    push_runtime_event(session, "Errored", failure.message, failure.details);
    session.pending_request = None;
    session.error_message = Some(failure.message.to_string());
}
