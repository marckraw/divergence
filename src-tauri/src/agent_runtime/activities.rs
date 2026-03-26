use super::constants::MAX_ACTIVITY_DETAILS_LENGTH;
use super::types::{AgentActivity, AgentActivityStatus, AgentSessionSnapshot};
use serde_json::Value;

pub(crate) fn complete_activity(
    session: &mut AgentSessionSnapshot,
    activity_id: &str,
    details: Option<String>,
    status: AgentActivityStatus,
) {
    let completed_at_ms = now_ms();
    if let Some(activity) = session
        .activities
        .iter_mut()
        .find(|item| item.id == activity_id)
    {
        let had_metadata = activity.summary.is_some()
            || activity.subject.is_some()
            || activity.group_key.is_some();
        activity.status = status;
        activity.completed_at_ms = Some(completed_at_ms);
        if let Some(details) = details {
            activity.details = Some(details);
        }
        if !had_metadata {
            refresh_activity_metadata(activity);
        }
        return;
    }

    session.activities.push(create_activity(
        activity_id.to_string(),
        "tool".to_string(),
        activity_id.to_string(),
        status,
        details,
        completed_at_ms,
        Some(completed_at_ms),
    ));
}

pub(crate) fn now_ms() -> i64 {
    chrono::Utc::now().timestamp_millis()
}

pub(crate) fn create_activity(
    id: String,
    kind: String,
    title: String,
    status: AgentActivityStatus,
    details: Option<String>,
    started_at_ms: i64,
    completed_at_ms: Option<i64>,
) -> AgentActivity {
    let (summary, subject, group_key) = derive_activity_metadata(&kind, &title, details.as_deref());

    AgentActivity {
        id,
        kind,
        title,
        summary,
        subject,
        group_key,
        status,
        details,
        started_at_ms,
        completed_at_ms,
    }
}

pub(crate) fn refresh_activity_metadata(activity: &mut AgentActivity) {
    let (summary, subject, group_key) =
        derive_activity_metadata(&activity.kind, &activity.title, activity.details.as_deref());
    activity.summary = summary;
    activity.subject = subject;
    activity.group_key = group_key;
}

pub(crate) fn derive_activity_metadata(
    kind: &str,
    title: &str,
    details: Option<&str>,
) -> (Option<String>, Option<String>, Option<String>) {
    let trimmed_title = title.trim();
    let normalized_title = trimmed_title.to_ascii_lowercase();
    let normalized_kind = kind.trim().to_ascii_lowercase();
    let is_command_like = normalized_kind == "command_execution"
        || matches!(normalized_title.as_str(), "bash" | "shell" | "command");
    let subject = if is_command_like {
        compact_command(trimmed_title)
            .or_else(|| details.and_then(extract_activity_command_subject))
    } else {
        details.and_then(extract_activity_subject)
    };
    let subject_ref = subject.as_deref();

    let (summary, group_key) = if is_command_like {
        (
            Some(format!(
                "Ran {}",
                subject_ref
                    .map(str::to_string)
                    .unwrap_or_else(|| trimmed_title.to_string())
            )),
            Some("command".to_string()),
        )
    } else if normalized_kind == "mcp_tool" {
        (
            Some(format!("Ran {}", compact_label(trimmed_title))),
            Some(format!("mcp:{}", normalized_title)),
        )
    } else if normalized_title == "read" {
        (
            Some(match subject_ref {
                Some(subject) => format!("Read {subject}"),
                None => "Read file".to_string(),
            }),
            Some("read".to_string()),
        )
    } else if matches!(
        normalized_title.as_str(),
        "edit" | "multiedit" | "write" | "filechange"
    ) || normalized_kind == "file_change"
    {
        (
            Some(match subject_ref {
                Some(subject) => format!("Edited {subject}"),
                None => "Edited file".to_string(),
            }),
            Some("edit".to_string()),
        )
    } else if normalized_title == "todowrite" {
        (
            Some("Updated todo list".to_string()),
            Some("todo".to_string()),
        )
    } else if matches!(normalized_title.as_str(), "search" | "grep" | "glob" | "ls") {
        (
            Some(match subject_ref {
                Some(subject) => format!("Searched {subject}"),
                None => format!("Ran {}", compact_label(trimmed_title)),
            }),
            Some("search".to_string()),
        )
    } else if normalized_kind == "skill" {
        (
            Some(format!("Ran skill {}", compact_label(trimmed_title))),
            Some(format!("skill:{}", normalized_title)),
        )
    } else if normalized_title == "thinking" || normalized_kind == "thought_process" {
        (Some("Thinking".to_string()), Some("thinking".to_string()))
    } else {
        (
            Some(compact_label(trimmed_title)),
            Some(format!("{}:{}", normalized_kind, normalized_title)),
        )
    };

    (summary, subject, group_key)
}

fn extract_activity_subject(details: &str) -> Option<String> {
    let trimmed = details.trim();
    if trimmed.is_empty() {
        return None;
    }

    if let Ok(value) = serde_json::from_str::<Value>(trimmed) {
        return extract_activity_subject_from_value(&value);
    }

    compact_subject(trimmed)
}

fn extract_activity_command_subject(details: &str) -> Option<String> {
    let trimmed = details.trim();
    if trimmed.is_empty() {
        return None;
    }

    if let Ok(value) = serde_json::from_str::<Value>(trimmed) {
        for key in ["command", "cmd"] {
            if let Some(subject) = extract_stringish_value(value.get(key)) {
                return compact_command(&subject);
            }
        }
        return extract_activity_subject_from_value(&value);
    }

    compact_command(trimmed)
}

fn extract_activity_subject_from_value(value: &Value) -> Option<String> {
    let path_keys = [
        "file_path",
        "path",
        "paths",
        "filename",
        "file",
        "relative_workspace_path",
    ];
    for key in path_keys {
        if let Some(subject) = extract_stringish_value(value.get(key)) {
            return compact_subject(&subject);
        }
    }

    let command_keys = ["command", "cmd"];
    for key in command_keys {
        if let Some(subject) = extract_stringish_value(value.get(key)) {
            return compact_command(&subject);
        }
    }

    let query_keys = ["pattern", "query", "term", "glob"];
    for key in query_keys {
        if let Some(subject) = extract_stringish_value(value.get(key)) {
            return compact_subject(&subject);
        }
    }

    None
}

fn extract_stringish_value(value: Option<&Value>) -> Option<String> {
    match value {
        Some(Value::String(text)) => Some(text.to_string()),
        Some(Value::Array(items)) => items.iter().find_map(|item| match item {
            Value::String(text) => Some(text.to_string()),
            _ => None,
        }),
        _ => None,
    }
}

fn compact_subject(subject: &str) -> Option<String> {
    let trimmed = subject.trim();
    if trimmed.is_empty() {
        return None;
    }

    let display = if trimmed.contains('/') || trimmed.contains('\\') {
        let basename = trimmed.rsplit(['/', '\\']).next().unwrap_or(trimmed).trim();
        if basename.is_empty() {
            trimmed
        } else {
            basename
        }
    } else {
        trimmed
    };

    Some(truncate_inline(display, 48))
}

fn compact_command(command: &str) -> Option<String> {
    let trimmed = command.trim();
    if trimmed.is_empty() {
        return None;
    }

    Some(truncate_inline(strip_shell_wrapper(trimmed), 56))
}

fn compact_label(label: &str) -> String {
    truncate_inline(label.trim(), 56)
}

fn truncate_inline(value: &str, max_chars: usize) -> String {
    let trimmed = value.trim().trim_end_matches("...[truncated]").trim();
    if trimmed.chars().count() <= max_chars {
        return trimmed.to_string();
    }

    let mut output: String = trimmed.chars().take(max_chars.saturating_sub(1)).collect();
    output.push('…');
    output
}

pub(crate) fn strip_shell_wrapper(command: &str) -> &str {
    const PREFIXES: [&str; 6] = [
        "/bin/zsh -lc ",
        "zsh -lc ",
        "/bin/bash -lc ",
        "bash -lc ",
        "/bin/sh -lc ",
        "sh -lc ",
    ];

    for prefix in PREFIXES {
        if let Some(rest) = command.strip_prefix(prefix) {
            return rest
                .strip_prefix('"')
                .and_then(|value| value.strip_suffix('"'))
                .or_else(|| {
                    rest.strip_prefix('\'')
                        .and_then(|value| value.strip_suffix('\''))
                })
                .unwrap_or(rest)
                .trim();
        }
    }

    command
}

pub(crate) fn truncate_details(input: &str) -> String {
    let trimmed = input.trim();
    if trimmed.chars().count() <= MAX_ACTIVITY_DETAILS_LENGTH {
        return trimmed.to_string();
    }

    let truncated: String = trimmed.chars().take(MAX_ACTIVITY_DETAILS_LENGTH).collect();
    format!("{truncated}\n...[truncated]")
}

pub(crate) fn truncate_json_details(input: &Value) -> String {
    truncate_details(&input.to_string())
}
