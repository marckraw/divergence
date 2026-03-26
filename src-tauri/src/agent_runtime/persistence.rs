use super::attachments::attachment_kind_from_mime_type;
use super::constants::MAX_RUNTIME_EVENTS;
use super::provider_registry::{default_model_for_provider, normalize_agent_effort};
use super::types::{
    AgentRuntimeDebugEvent, AgentRuntimeStatus, AgentSessionNameMode, AgentSessionRole,
    AgentSessionSnapshot, AgentSessionStatus,
};
use serde_json::Value;
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use uuid::Uuid;

pub(super) fn default_persistence_path() -> PathBuf {
    let base = dirs::data_local_dir()
        .or_else(dirs::home_dir)
        .unwrap_or_else(|| PathBuf::from("."));
    base.join("divergence")
        .join("agent-runtime")
        .join("sessions.json")
}

pub(super) fn load_persisted_sessions(path: &Path) -> HashMap<String, AgentSessionSnapshot> {
    let Ok(raw) = fs::read_to_string(path) else {
        return HashMap::new();
    };

    let Ok(items) = serde_json::from_str::<Vec<Value>>(&raw) else {
        eprintln!(
            "[agent_runtime] Failed to parse persisted session snapshot array at {}",
            path.display()
        );
        return HashMap::new();
    };

    items
        .into_iter()
        .filter_map(
            |item| match serde_json::from_value::<AgentSessionSnapshot>(item) {
                Ok(session) => Some(normalize_persisted_session(session)),
                Err(error) => {
                    eprintln!(
                        "[agent_runtime] Skipping unreadable persisted session in {}: {}",
                        path.display(),
                        error
                    );
                    None
                }
            },
        )
        .map(|item| (item.id.clone(), item))
        .collect()
}

fn normalize_persisted_session(mut session: AgentSessionSnapshot) -> AgentSessionSnapshot {
    if session.model.trim().is_empty() {
        session.model = default_model_for_provider(&session.provider).to_string();
    }
    session.effort =
        normalize_agent_effort(&session.provider, &session.model, session.effort.as_deref());
    if matches!(
        session.session_role,
        AgentSessionRole::ReviewAgent | AgentSessionRole::Manual
    ) && !matches!(session.name_mode, AgentSessionNameMode::Manual)
    {
        session.name_mode = AgentSessionNameMode::Manual;
    }
    if session.runtime_events.len() > MAX_RUNTIME_EVENTS {
        let keep_from = session.runtime_events.len() - MAX_RUNTIME_EVENTS;
        session.runtime_events = session.runtime_events.split_off(keep_from);
    }
    for message in &mut session.messages {
        if let Some(attachments) = &mut message.attachments {
            for attachment in attachments {
                if let Ok(kind) = attachment_kind_from_mime_type(&attachment.mime_type) {
                    attachment.kind = kind;
                }
            }
        }
    }
    if matches!(
        session.runtime_status,
        AgentRuntimeStatus::Running | AgentRuntimeStatus::Waiting
    ) {
        session.status = AgentSessionStatus::Idle;
        session.runtime_status = AgentRuntimeStatus::Stopped;
        session.pending_request = None;
        session.runtime_phase = Some("Interrupted".to_string());
        if session.error_message.is_none() {
            session.error_message =
                Some("Agent runtime was interrupted when Divergence closed.".to_string());
        }
        if session.current_turn_started_at_ms.is_some() {
            let at_ms = session
                .last_runtime_event_at_ms
                .unwrap_or(session.updated_at_ms);
            session.last_runtime_event_at_ms = Some(at_ms);
            session.runtime_events.push(AgentRuntimeDebugEvent {
                id: format!("runtime-event-{}", Uuid::new_v4()),
                at_ms,
                phase: "Interrupted".to_string(),
                message: "Agent runtime was interrupted when Divergence closed.".to_string(),
                details: None,
            });
            if session.runtime_events.len() > MAX_RUNTIME_EVENTS {
                let overflow = session.runtime_events.len() - MAX_RUNTIME_EVENTS;
                session.runtime_events.drain(0..overflow);
            }
        }
    }
    session
}
