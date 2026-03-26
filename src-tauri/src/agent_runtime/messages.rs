use super::activities::now_ms;
use super::types::{AgentMessage, AgentMessageRole, AgentMessageStatus, AgentSessionSnapshot};
use uuid::Uuid;

pub(crate) fn last_assistant_message_mut(session: &mut AgentSessionSnapshot) -> Option<&mut AgentMessage> {
    let index = last_assistant_message_index(session)?;
    session.messages.get_mut(index)
}

pub(crate) fn assistant_message_mut<'a>(
    session: &'a mut AgentSessionSnapshot,
    item_id: Option<&str>,
) -> Option<&'a mut AgentMessage> {
    if let Some(item_id) = item_id {
        if let Some(index) = session.messages.iter().position(|message| {
            matches!(message.role, AgentMessageRole::Assistant) && message.id == item_id
        }) {
            return session.messages.get_mut(index);
        }
    }

    last_assistant_message_mut(session)
}

pub(crate) fn ensure_assistant_message<'a>(
    session: &'a mut AgentSessionSnapshot,
    item_id: Option<&str>,
) -> &'a mut AgentMessage {
    if let Some(item_id) = item_id {
        if let Some(index) = session.messages.iter().position(|message| {
            matches!(message.role, AgentMessageRole::Assistant) && message.id == item_id
        }) {
            return session
                .messages
                .get_mut(index)
                .expect("assistant message index should be valid");
        }

        session.messages.push(AgentMessage {
            id: item_id.to_string(),
            role: AgentMessageRole::Assistant,
            content: String::new(),
            status: AgentMessageStatus::Streaming,
            created_at_ms: now_ms(),
            interaction_mode: None,
            attachments: None,
        });
        let last_index = session.messages.len().saturating_sub(1);
        return session
            .messages
            .get_mut(last_index)
            .expect("assistant message should exist after push");
    }

    if last_assistant_message_index(session).is_none() {
        session.messages.push(AgentMessage {
            id: format!("message-{}", Uuid::new_v4()),
            role: AgentMessageRole::Assistant,
            content: String::new(),
            status: AgentMessageStatus::Streaming,
            created_at_ms: now_ms(),
            interaction_mode: None,
            attachments: None,
        });
    }

    let last_index = last_assistant_message_index(session)
        .expect("assistant message should exist after initialization");
    let should_split_existing_message = session
        .messages
        .get(last_index)
        .map(|message| has_activity_after_assistant_message(session, message))
        .unwrap_or(false);

    if should_split_existing_message {
        let existing_message = session
            .messages
            .get_mut(last_index)
            .expect("assistant message index should be valid");
        if existing_message.content.trim().is_empty() {
            existing_message.created_at_ms = now_ms();
            existing_message.status = AgentMessageStatus::Streaming;
            return session
                .messages
                .get_mut(last_index)
                .expect("assistant message index should stay valid");
        }

        if matches!(existing_message.status, AgentMessageStatus::Streaming) {
            existing_message.status = AgentMessageStatus::Done;
        }

        session.messages.push(AgentMessage {
            id: format!("message-{}", Uuid::new_v4()),
            role: AgentMessageRole::Assistant,
            content: String::new(),
            status: AgentMessageStatus::Streaming,
            created_at_ms: now_ms(),
            interaction_mode: None,
            attachments: None,
        });
    }

    last_assistant_message_mut(session).expect("assistant message should exist")
}

pub(crate) fn append_assistant_text(session: &mut AgentSessionSnapshot, item_id: Option<&str>, text: &str) {
    let message = ensure_assistant_message(session, item_id);
    if !matches!(message.status, AgentMessageStatus::Streaming) {
        message.status = AgentMessageStatus::Streaming;
    }
    message.content.push_str(text);
}

pub(crate) fn append_assistant_paragraph(
    session: &mut AgentSessionSnapshot,
    item_id: Option<&str>,
    text: &str,
) {
    let message = ensure_assistant_message(session, item_id);
    if !matches!(message.status, AgentMessageStatus::Streaming) {
        message.status = AgentMessageStatus::Streaming;
    }
    if !message.content.trim().is_empty() {
        message.content.push_str("\n\n");
    }
    message.content.push_str(text.trim());
}

pub(crate) fn assistant_message_text<'a>(session: &'a AgentSessionSnapshot, item_id: Option<&str>) -> &'a str {
    if let Some(item_id) = item_id {
        if let Some(message) = session.messages.iter().find(|message| {
            matches!(message.role, AgentMessageRole::Assistant) && message.id == item_id
        }) {
            return message.content.as_str();
        }
    }

    last_assistant_message_text(session)
}

fn last_assistant_message_text(session: &AgentSessionSnapshot) -> &str {
    session
        .messages
        .iter()
        .rev()
        .find(|message| matches!(message.role, AgentMessageRole::Assistant))
        .map(|message| message.content.as_str())
        .unwrap_or("")
}

fn last_assistant_message_index(session: &AgentSessionSnapshot) -> Option<usize> {
    session
        .messages
        .iter()
        .enumerate()
        .rev()
        .find(|(_, message)| matches!(message.role, AgentMessageRole::Assistant))
        .map(|(index, _)| index)
}

fn has_activity_after_assistant_message(
    session: &AgentSessionSnapshot,
    message: &AgentMessage,
) -> bool {
    session.activities.iter().any(|activity| {
        activity.started_at_ms > message.created_at_ms
            || activity
                .completed_at_ms
                .map(|completed_at_ms| completed_at_ms > message.created_at_ms)
                .unwrap_or(false)
    })
}
