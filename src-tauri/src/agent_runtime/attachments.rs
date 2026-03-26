use super::types::{AgentAttachment, AgentAttachmentKind, AgentProvider};
use std::fs;
use std::path::PathBuf;

fn default_attachment_base_dir() -> PathBuf {
    let base = dirs::data_local_dir()
        .or_else(dirs::home_dir)
        .unwrap_or_else(|| PathBuf::from("."));
    base.join("divergence")
        .join("agent-runtime")
        .join("attachments")
}

pub(crate) fn session_attachment_dir(session_id: &str) -> PathBuf {
    default_attachment_base_dir().join(session_id)
}

fn sanitize_attachment_name(name: &str) -> String {
    let trimmed = name.trim();
    let mut sanitized = trimmed
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() || matches!(character, '.' | '-' | '_') {
                character
            } else {
                '-'
            }
        })
        .collect::<String>();
    while sanitized.contains("--") {
        sanitized = sanitized.replace("--", "-");
    }
    sanitized.trim_matches('-').to_string()
}

pub(crate) fn attachment_kind_from_mime_type(mime_type: &str) -> Result<AgentAttachmentKind, String> {
    let normalized_mime_type = mime_type.trim().to_ascii_lowercase();
    if normalized_mime_type.starts_with("image/") {
        return Ok(AgentAttachmentKind::Image);
    }
    if normalized_mime_type == "application/pdf" {
        return Ok(AgentAttachmentKind::Pdf);
    }
    Err(format!(
        "Unsupported attachment type '{mime_type}'. Only image and PDF attachments are supported."
    ))
}

pub(crate) fn validate_turn_attachments_for_provider(
    provider: &AgentProvider,
    attachments: &[AgentAttachment],
) -> Result<(), String> {
    for attachment in attachments {
        let is_supported = match provider {
            AgentProvider::Codex | AgentProvider::Claude => {
                matches!(attachment.kind, AgentAttachmentKind::Image)
            }
            AgentProvider::Cursor => false,
            AgentProvider::Gemini => matches!(
                attachment.kind,
                AgentAttachmentKind::Image | AgentAttachmentKind::Pdf
            ),
            AgentProvider::Opencode => false,
        };
        if is_supported {
            continue;
        }

        let provider_label = match provider {
            AgentProvider::Claude => "Claude",
            AgentProvider::Codex => "Codex",
            AgentProvider::Cursor => "Cursor",
            AgentProvider::Gemini => "Gemini",
            AgentProvider::Opencode => "OpenCode",
        };

        let kind_label = match attachment.kind {
            AgentAttachmentKind::Image => "image",
            AgentAttachmentKind::Pdf => "PDF",
        };

        return Err(format!(
            "{provider_label} does not support {kind_label} attachments in Divergence yet."
        ));
    }

    Ok(())
}

pub(crate) fn build_attachment_filename(attachment_id: &str, name: &str) -> String {
    let sanitized_name = sanitize_attachment_name(name);
    if sanitized_name.is_empty() {
        attachment_id.to_string()
    } else {
        format!("{attachment_id}-{sanitized_name}")
    }
}

pub(crate) fn resolve_staged_attachment_path(
    session_id: &str,
    attachment_id: &str,
) -> Result<PathBuf, String> {
    let attachment_dir = session_attachment_dir(session_id);
    let entries = fs::read_dir(&attachment_dir).map_err(|error| {
        format!("Failed to read staged attachments for session {session_id}: {error}")
    })?;
    for entry in entries {
        let entry =
            entry.map_err(|error| format!("Failed to inspect staged attachment: {error}"))?;
        let path = entry.path();
        let Some(file_name) = path.file_name().and_then(|value| value.to_str()) else {
            continue;
        };
        if file_name.starts_with(attachment_id) {
            return Ok(path);
        }
    }
    Err(format!(
        "Staged attachment not found for session {session_id}: {attachment_id}"
    ))
}
