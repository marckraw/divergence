use super::*;

const LOW_MEDIUM_HIGH_EFFORTS: &[&str] = &["low", "medium", "high"];
const LOW_TO_XHIGH_EFFORTS: &[&str] = &["low", "medium", "high", "xhigh"];
const NONE_TO_XHIGH_EFFORTS: &[&str] = &["none", "low", "medium", "high", "xhigh"];

pub(super) fn provider_descriptors() -> Vec<AgentRuntimeProviderDescriptor> {
    let (cursor_default_model, cursor_model_options) = cursor_model_catalog();
    let gemini_stream_json_supported = gemini_supports_stream_json();
    let mut descriptors = vec![
        AgentRuntimeProviderDescriptor {
            id: "claude".to_string(),
            label: "Claude".to_string(),
            transport: AgentRuntimeProviderTransport::CliHeadless,
            default_model: DEFAULT_CLAUDE_MODEL.to_string(),
            model_options: vec![
                AgentRuntimeModelOption {
                    slug: "default".to_string(),
                    label: "Default (tier-based)".to_string(),
                },
                AgentRuntimeModelOption {
                    slug: DEFAULT_CLAUDE_MODEL.to_string(),
                    label: "Sonnet (latest, 4.6)".to_string(),
                },
                AgentRuntimeModelOption {
                    slug: "opus".to_string(),
                    label: "Opus (latest, 4.6)".to_string(),
                },
                AgentRuntimeModelOption {
                    slug: "haiku".to_string(),
                    label: "Haiku (latest, 4.5)".to_string(),
                },
                AgentRuntimeModelOption {
                    slug: "opusplan".to_string(),
                    label: "OpusPlan (Opus plan, Sonnet execute)".to_string(),
                },
                AgentRuntimeModelOption {
                    slug: "claude-sonnet-4-6".to_string(),
                    label: "Claude Sonnet 4.6 (pinned)".to_string(),
                },
                AgentRuntimeModelOption {
                    slug: "claude-opus-4-6".to_string(),
                    label: "Claude Opus 4.6 (pinned)".to_string(),
                },
                AgentRuntimeModelOption {
                    slug: "claude-haiku-4-5".to_string(),
                    label: "Claude Haiku 4.5 (pinned)".to_string(),
                },
            ],
            readiness: provider_readiness(&AgentProvider::Claude),
            features: AgentRuntimeProviderFeatures {
                streaming: true,
                resume: true,
                structured_requests: false,
                plan_mode: true,
                attachment_kinds: vec![AgentAttachmentKind::Image],
                structured_plan_ui: false,
                usage_inspection: false,
                provider_extras: false,
            },
        },
        AgentRuntimeProviderDescriptor {
            id: "codex".to_string(),
            label: "Codex".to_string(),
            transport: AgentRuntimeProviderTransport::AppServer,
            default_model: DEFAULT_CODEX_MODEL.to_string(),
            model_options: vec![
                AgentRuntimeModelOption {
                    slug: DEFAULT_CODEX_MODEL.to_string(),
                    label: "GPT-5.4".to_string(),
                },
                AgentRuntimeModelOption {
                    slug: "gpt-5.3-codex".to_string(),
                    label: "GPT-5.3 Codex".to_string(),
                },
                AgentRuntimeModelOption {
                    slug: "gpt-5.3-codex-spark".to_string(),
                    label: "GPT-5.3 Codex Spark".to_string(),
                },
                AgentRuntimeModelOption {
                    slug: "gpt-5.2-codex".to_string(),
                    label: "GPT-5.2 Codex".to_string(),
                },
                AgentRuntimeModelOption {
                    slug: "gpt-5.2".to_string(),
                    label: "GPT-5.2".to_string(),
                },
            ],
            readiness: provider_readiness(&AgentProvider::Codex),
            features: AgentRuntimeProviderFeatures {
                streaming: true,
                resume: true,
                structured_requests: true,
                plan_mode: true,
                attachment_kinds: vec![AgentAttachmentKind::Image],
                structured_plan_ui: true,
                usage_inspection: true,
                provider_extras: true,
            },
        },
        AgentRuntimeProviderDescriptor {
            id: "cursor".to_string(),
            label: "Cursor".to_string(),
            transport: AgentRuntimeProviderTransport::CliHeadless,
            default_model: cursor_default_model,
            model_options: cursor_model_options,
            readiness: provider_readiness(&AgentProvider::Cursor),
            features: AgentRuntimeProviderFeatures {
                streaming: true,
                resume: true,
                structured_requests: false,
                plan_mode: true,
                attachment_kinds: vec![],
                structured_plan_ui: false,
                usage_inspection: false,
                provider_extras: true,
            },
        },
        AgentRuntimeProviderDescriptor {
            id: "gemini".to_string(),
            label: "Gemini".to_string(),
            transport: AgentRuntimeProviderTransport::CliHeadless,
            default_model: DEFAULT_GEMINI_MODEL.to_string(),
            model_options: vec![
                AgentRuntimeModelOption {
                    slug: DEFAULT_GEMINI_MODEL.to_string(),
                    label: "Gemini 2.5 Pro".to_string(),
                },
                AgentRuntimeModelOption {
                    slug: "gemini-2.5-flash".to_string(),
                    label: "Gemini 2.5 Flash".to_string(),
                },
            ],
            readiness: provider_readiness(&AgentProvider::Gemini),
            features: AgentRuntimeProviderFeatures {
                streaming: gemini_stream_json_supported,
                resume: false,
                structured_requests: false,
                plan_mode: true,
                attachment_kinds: vec![AgentAttachmentKind::Image, AgentAttachmentKind::Pdf],
                structured_plan_ui: false,
                usage_inspection: false,
                provider_extras: true,
            },
        },
    ];
    descriptors.sort_by(|left, right| left.label.cmp(&right.label));
    descriptors
}

pub(super) fn default_model_for_provider(provider: &AgentProvider) -> &'static str {
    match provider {
        AgentProvider::Claude => DEFAULT_CLAUDE_MODEL,
        AgentProvider::Codex => DEFAULT_CODEX_MODEL,
        AgentProvider::Cursor => DEFAULT_CURSOR_MODEL,
        AgentProvider::Gemini => DEFAULT_GEMINI_MODEL,
    }
}

pub(super) fn normalize_agent_model(provider: &AgentProvider, raw_model: Option<&str>) -> String {
    let Some(trimmed_model) = raw_model.map(str::trim).filter(|model| !model.is_empty()) else {
        return default_model_for_provider(provider).to_string();
    };
    trimmed_model.to_string()
}

pub(super) fn default_effort_for_provider_model(
    provider: &AgentProvider,
    model: &str,
) -> Option<&'static str> {
    (!supported_efforts_for_provider_model(provider, model).is_empty()).then_some("medium")
}

pub(super) fn normalize_agent_effort(
    provider: &AgentProvider,
    model: &str,
    raw_effort: Option<&str>,
) -> Option<String> {
    let supported_efforts = supported_efforts_for_provider_model(provider, model);
    if supported_efforts.is_empty() {
        return None;
    }

    let normalized_effort = raw_effort
        .map(str::trim)
        .filter(|effort| !effort.is_empty())
        .map(str::to_ascii_lowercase);

    if let Some(effort) = normalized_effort {
        if supported_efforts.iter().any(|candidate| *candidate == effort) {
            return Some(effort);
        }
    }

    default_effort_for_provider_model(provider, model).map(str::to_string)
}

pub(super) fn build_claude_command(
    session: &AgentSessionSnapshot,
    interaction_mode: AgentInteractionMode,
    claude_oauth_token: &str,
    attachment_dirs: &[PathBuf],
) -> Command {
    let mut command = Command::new("claude");
    command
        .arg("-p")
        .arg("--verbose")
        .arg("--output-format")
        .arg("stream-json")
        .arg("--include-partial-messages")
        .arg("--dangerously-skip-permissions");
    if matches!(interaction_mode, AgentInteractionMode::Plan) {
        command.arg("--permission-mode").arg("plan");
    }
    if !session.model.trim().is_empty() {
        command.arg("--model").arg(session.model.trim());
    }
    if let Some(effort) = session.effort.as_deref().filter(|value| !value.trim().is_empty()) {
        command.arg("--effort").arg(effort);
    }
    if let Some(thread_id) = session.thread_id.as_deref() {
        command.arg("--resume").arg(thread_id);
    }
    for attachment_dir in attachment_dirs {
        command.arg("--add-dir").arg(attachment_dir);
    }
    if !claude_oauth_token.trim().is_empty() {
        command.env("CLAUDE_CODE_OAUTH_TOKEN", claude_oauth_token.trim());
    }
    command
}

pub(super) fn build_cursor_command(
    session: &AgentSessionSnapshot,
    prompt: &str,
    interaction_mode: AgentInteractionMode,
) -> Result<Command, String> {
    let binary = detect_cursor_binary().ok_or_else(|| {
        "Cursor Agent was not found. Install cursor-agent and log in before starting a Cursor session."
            .to_string()
    })?;

    let mut command = Command::new(binary);
    command
        .arg("--print")
        .arg("--output-format")
        .arg("stream-json")
        .arg("--stream-partial-output")
        .arg("--workspace")
        .arg(&session.path)
        .arg("--model")
        .arg(session.model.trim())
        .arg("--force")
        .arg("--trust");

    if matches!(interaction_mode, AgentInteractionMode::Plan) {
        command.arg("--mode").arg("plan");
    }

    if let Some(thread_id) = session.thread_id.as_deref() {
        command.arg("--resume").arg(thread_id);
    }

    command.arg(prompt);
    Ok(command)
}

pub(super) fn build_gemini_command(
    session: &AgentSessionSnapshot,
    prompt: &str,
    interaction_mode: AgentInteractionMode,
    attachment_dirs: &[PathBuf],
) -> Result<Command, String> {
    let binary = detect_gemini_binary().ok_or_else(|| {
        "Gemini CLI was not found. Install gemini and log in with a supported Google account before starting a Gemini session."
            .to_string()
    })?;

    let mut command = Command::new(binary);
    command
        .arg("-p")
        .arg(build_history_context_prompt(session, prompt));
    if gemini_supports_stream_json() {
        command.arg("--output-format").arg("stream-json");
    }
    command.arg("-m").arg(session.model.trim());
    command.args(gemini_approval_args(interaction_mode));
    for attachment_dir in attachment_dirs {
        command.arg("--include-directories").arg(attachment_dir);
    }
    Ok(command)
}

fn gemini_approval_args(interaction_mode: AgentInteractionMode) -> &'static [&'static str] {
    match interaction_mode {
        AgentInteractionMode::Default => &["-y"],
        AgentInteractionMode::Plan => &["--approval-mode", "plan"],
    }
}

fn supported_efforts_for_provider_model(provider: &AgentProvider, model: &str) -> &'static [&'static str] {
    match provider {
        AgentProvider::Claude => {
            if is_claude_opus_model(model) {
                &["low", "medium", "high", "max"]
            } else {
                LOW_MEDIUM_HIGH_EFFORTS
            }
        }
        AgentProvider::Codex => match normalize_model_alias(model).as_str() {
            "gpt-5.4" | "gpt-5.2" => NONE_TO_XHIGH_EFFORTS,
            "gpt-5.3-codex" | "gpt-5.3-codex-spark" | "gpt-5.2-codex" => {
                LOW_TO_XHIGH_EFFORTS
            }
            _ => LOW_MEDIUM_HIGH_EFFORTS,
        },
        AgentProvider::Cursor | AgentProvider::Gemini => &[],
    }
}

fn is_claude_opus_model(model: &str) -> bool {
    matches!(
        normalize_model_alias(model).as_str(),
        "opus" | "claude-opus-4-6"
    )
}

fn normalize_model_alias(model: &str) -> String {
    model.trim().to_ascii_lowercase()
}

fn cursor_model_catalog() -> (String, Vec<AgentRuntimeModelOption>) {
    let fallback = (
        DEFAULT_CURSOR_MODEL.to_string(),
        vec![
            AgentRuntimeModelOption {
                slug: "auto".to_string(),
                label: "Auto".to_string(),
            },
            AgentRuntimeModelOption {
                slug: "gpt-5.4-medium".to_string(),
                label: "GPT-5.4".to_string(),
            },
            AgentRuntimeModelOption {
                slug: "opus-4.6-thinking".to_string(),
                label: "Claude 4.6 Opus (Thinking)".to_string(),
            },
            AgentRuntimeModelOption {
                slug: "sonnet-4.6".to_string(),
                label: "Claude 4.6 Sonnet".to_string(),
            },
        ],
    );

    let Some(command) = detect_cursor_binary() else {
        return fallback;
    };

    let Ok(output) = StdCommand::new(command).arg("models").output() else {
        return fallback;
    };

    if !output.status.success() {
        return fallback;
    }

    let stdout = strip_ansi_sequences(&String::from_utf8_lossy(&output.stdout));
    let mut default_model = DEFAULT_CURSOR_MODEL.to_string();
    let mut model_options = Vec::new();

    for line in stdout
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
    {
        let Some((slug, raw_label)) = line.split_once(" - ") else {
            continue;
        };
        if slug.eq_ignore_ascii_case("available models") || slug.starts_with("Loading models") {
            continue;
        }

        let (label, marker) = raw_label
            .rsplit_once("  (")
            .map(|(clean_label, suffix)| {
                (
                    clean_label.trim().to_string(),
                    suffix.strip_suffix(')').unwrap_or(suffix).to_string(),
                )
            })
            .unwrap_or_else(|| (raw_label.trim().to_string(), String::new()));

        if marker.contains("default") {
            default_model = slug.trim().to_string();
        }

        model_options.push(AgentRuntimeModelOption {
            slug: slug.trim().to_string(),
            label,
        });
    }

    if model_options.is_empty() {
        return fallback;
    }

    if !model_options
        .iter()
        .any(|option| option.slug == default_model)
    {
        default_model = model_options
            .first()
            .map(|option| option.slug.clone())
            .unwrap_or_else(|| DEFAULT_CURSOR_MODEL.to_string());
    }

    (default_model, model_options)
}

fn gemini_supports_stream_json() -> bool {
    let Some(command) = detect_gemini_binary() else {
        return false;
    };

    let Ok(output) = StdCommand::new(command).arg("--help").output() else {
        return false;
    };

    let combined = format!(
        "{}{}",
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr)
    );

    combined.contains("stream-json")
}

fn detect_binary(candidates: &[&str]) -> Option<String> {
    candidates.iter().find_map(|candidate| {
        StdCommand::new(candidate)
            .arg("--version")
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status()
            .ok()
            .filter(|status| status.success())
            .map(|_| (*candidate).to_string())
    })
}

fn strip_ansi_sequences(input: &str) -> String {
    let mut output = String::new();
    let mut chars = input.chars().peekable();

    while let Some(character) = chars.next() {
        if character == '\u{1b}' {
            if chars.peek() == Some(&'[') {
                chars.next();
                for next_character in chars.by_ref() {
                    if ('@'..='~').contains(&next_character) {
                        break;
                    }
                }
                continue;
            }
            continue;
        }

        if !character.is_control() || matches!(character, '\n' | '\r' | '\t') {
            output.push(character);
        }
    }

    output
}

#[cfg(test)]
mod tests {
    use super::{
        build_claude_command, default_effort_for_provider_model, gemini_approval_args,
        normalize_agent_effort, AgentInteractionMode, AgentProvider, AgentRuntimeStatus,
        AgentSessionNameMode, AgentSessionRole, AgentSessionSnapshot, AgentSessionStatus,
        AgentTargetType,
    };
    use std::path::PathBuf;

    fn build_test_session(model: &str, effort: Option<&str>) -> AgentSessionSnapshot {
        AgentSessionSnapshot {
            id: "session-1".to_string(),
            provider: AgentProvider::Claude,
            model: model.to_string(),
            effort: effort.map(str::to_string),
            target_type: AgentTargetType::Project,
            target_id: 1,
            project_id: 1,
            workspace_owner_id: None,
            workspace_key: "project:1".to_string(),
            session_role: AgentSessionRole::Default,
            name_mode: AgentSessionNameMode::Default,
            name: "Session".to_string(),
            path: "/tmp/project".to_string(),
            status: AgentSessionStatus::Idle,
            runtime_status: AgentRuntimeStatus::Idle,
            is_open: true,
            created_at_ms: 1,
            updated_at_ms: 1,
            thread_id: None,
            current_turn_started_at_ms: None,
            last_runtime_event_at_ms: None,
            runtime_phase: None,
            conversation_context: None,
            runtime_events: Vec::new(),
            messages: Vec::new(),
            activities: Vec::new(),
            pending_request: None,
            error_message: None,
        }
    }

    #[test]
    fn gemini_default_mode_uses_yolo_flag() {
        assert_eq!(gemini_approval_args(AgentInteractionMode::Default), ["-y"]);
    }

    #[test]
    fn gemini_plan_mode_uses_plan_approval_without_yolo() {
        assert_eq!(
            gemini_approval_args(AgentInteractionMode::Plan),
            ["--approval-mode", "plan"]
        );
    }

    #[test]
    fn normalizes_effort_by_provider_and_model() {
        assert_eq!(
            default_effort_for_provider_model(&AgentProvider::Codex, "gpt-5.4"),
            Some("medium")
        );
        assert_eq!(
            normalize_agent_effort(&AgentProvider::Codex, "gpt-5.3-codex", Some("none"))
                .as_deref(),
            Some("medium")
        );
        assert_eq!(
            normalize_agent_effort(&AgentProvider::Claude, "opus", Some("max")).as_deref(),
            Some("max")
        );
        assert_eq!(
            normalize_agent_effort(&AgentProvider::Gemini, "gemini-2.5-pro", Some("medium")),
            None
        );
    }

    #[test]
    fn claude_command_includes_effort_when_session_has_one() {
        let command = build_claude_command(
            &build_test_session("opus", Some("max")),
            AgentInteractionMode::Default,
            "",
            &[PathBuf::from("/tmp/attachments")],
        );
        let args: Vec<String> = command
            .as_std()
            .get_args()
            .map(|value| value.to_string_lossy().into_owned())
            .collect();

        assert!(args.windows(2).any(|pair| pair == ["--model", "opus"]));
        assert!(args.windows(2).any(|pair| pair == ["--effort", "max"]));
    }
}

fn detect_cursor_binary() -> Option<String> {
    detect_binary(&["cursor-agent", "agent"])
}

fn detect_gemini_binary() -> Option<String> {
    detect_binary(&["gemini"])
}

fn check_codex_auth(command: &str) -> (bool, Option<String>) {
    match StdCommand::new(command).arg("login").arg("status").output() {
        Ok(output) => {
            let combined = format!(
                "{}{}",
                String::from_utf8_lossy(&output.stdout),
                String::from_utf8_lossy(&output.stderr)
            );
            let trimmed = combined.trim().to_string();
            (
                output.status.success(),
                (!trimmed.is_empty()).then_some(trimmed),
            )
        }
        Err(error) => (
            false,
            Some(format!("Failed to inspect Codex auth state: {error}")),
        ),
    }
}

fn check_cursor_auth(command: &str) -> bool {
    let output = StdCommand::new(command).arg("whoami").output();
    match output {
        Ok(output) => output.status.success(),
        Err(_) => false,
    }
}

fn build_history_context_prompt(session: &AgentSessionSnapshot, prompt: &str) -> String {
    let mut sections = Vec::new();
    let prior_messages: Vec<String> = session
        .messages
        .iter()
        .filter(|message| {
            !(matches!(message.role, AgentMessageRole::User)
                && message.content.trim() == prompt.trim())
        })
        .map(|message| {
            let role = match message.role {
                AgentMessageRole::User => "User",
                AgentMessageRole::Assistant => "Assistant",
                AgentMessageRole::System => "System",
            };
            format!("{role}: {}", message.content.trim())
        })
        .filter(|item| !item.trim().ends_with(':'))
        .collect();

    if !prior_messages.is_empty() {
        sections.push(
            "Continue this Divergence session using the prior conversation below.".to_string(),
        );
        sections.push(prior_messages.join("\n\n"));
    }
    sections.push(format!("User: {}", prompt.trim()));
    sections.join("\n\n")
}

fn provider_readiness(provider: &AgentProvider) -> AgentRuntimeProviderReadiness {
    match provider {
        AgentProvider::Claude => {
            let detected = detect_binary(&["claude"]);
            if let Some(command) = detected {
                AgentRuntimeProviderReadiness {
                    status: AgentRuntimeProviderReadinessStatus::Partial,
                    summary:
                        "Claude CLI detected. Divergence assumes local login or OAuth token setup."
                            .to_string(),
                    details: vec![
                        "Use the official Claude CLI login flow for subscription-backed access."
                            .to_string(),
                        "Automations can still use the stored Claude OAuth token when needed."
                            .to_string(),
                    ],
                    binary_candidates: vec!["claude".to_string()],
                    detected_command: Some(command),
                    auth_status: AgentRuntimeProviderAuthStatus::Unknown,
                }
            } else {
                AgentRuntimeProviderReadiness {
                    status: AgentRuntimeProviderReadinessStatus::SetupRequired,
                    summary: "Claude CLI not found.".to_string(),
                    details: vec![
                        "Install Claude Code CLI and log in locally before using Claude sessions."
                            .to_string(),
                    ],
                    binary_candidates: vec!["claude".to_string()],
                    detected_command: None,
                    auth_status: AgentRuntimeProviderAuthStatus::Missing,
                }
            }
        }
        AgentProvider::Codex => {
            let detected = detect_binary(&["codex"]);
            let auth = detected
                .as_deref()
                .map(check_codex_auth)
                .unwrap_or((false, None));

            if detected.is_none() {
                return AgentRuntimeProviderReadiness {
                    status: AgentRuntimeProviderReadinessStatus::SetupRequired,
                    summary: "Codex CLI not found.".to_string(),
                    details: vec![
                        "Install Codex CLI and log in with your ChatGPT account before using Codex sessions.".to_string(),
                    ],
                    binary_candidates: vec!["codex".to_string()],
                    detected_command: None,
                    auth_status: AgentRuntimeProviderAuthStatus::Missing,
                };
            }

            let (authenticated, detail) = auth;
            AgentRuntimeProviderReadiness {
                status: if authenticated {
                    AgentRuntimeProviderReadinessStatus::Ready
                } else {
                    AgentRuntimeProviderReadinessStatus::Partial
                },
                summary: if authenticated {
                    "Codex App Server ready.".to_string()
                } else {
                    "Codex CLI detected, but login could not be confirmed.".to_string()
                },
                details: detail.into_iter().collect(),
                binary_candidates: vec!["codex".to_string()],
                detected_command: detected,
                auth_status: if authenticated {
                    AgentRuntimeProviderAuthStatus::Authenticated
                } else {
                    AgentRuntimeProviderAuthStatus::Missing
                },
            }
        }
        AgentProvider::Cursor => {
            let detected = detect_cursor_binary();
            if let Some(command) = detected.clone() {
                let authenticated = check_cursor_auth(&command);
                AgentRuntimeProviderReadiness {
                    status: if authenticated {
                        AgentRuntimeProviderReadinessStatus::Ready
                    } else {
                        AgentRuntimeProviderReadinessStatus::Partial
                    },
                    summary: if authenticated {
                        "Cursor Agent detected and authenticated.".to_string()
                    } else {
                        "Cursor Agent detected. Run cursor-agent login to use subscription-backed sessions.".to_string()
                    },
                    details: vec![
                        "Cursor sessions use the official local CLI login cache instead of API keys.".to_string(),
                        "Divergence runs Cursor in print/headless mode with stream-json output.".to_string(),
                    ],
                    binary_candidates: vec!["cursor-agent".to_string(), "agent".to_string()],
                    detected_command: Some(command),
                    auth_status: if authenticated {
                        AgentRuntimeProviderAuthStatus::Authenticated
                    } else {
                        AgentRuntimeProviderAuthStatus::Missing
                    },
                }
            } else {
                AgentRuntimeProviderReadiness {
                    status: AgentRuntimeProviderReadinessStatus::SetupRequired,
                    summary: "Cursor Agent CLI not found.".to_string(),
                    details: vec![
                        "Install Cursor Agent CLI and log in with your Cursor account before using Cursor sessions.".to_string(),
                    ],
                    binary_candidates: vec!["cursor-agent".to_string(), "agent".to_string()],
                    detected_command: None,
                    auth_status: AgentRuntimeProviderAuthStatus::Missing,
                }
            }
        }
        AgentProvider::Gemini => {
            let detected = detect_gemini_binary();
            if let Some(command) = detected {
                let stream_json_supported = gemini_supports_stream_json();
                AgentRuntimeProviderReadiness {
                    status: AgentRuntimeProviderReadinessStatus::Partial,
                    summary: "Gemini CLI detected. Login/setup must be managed through the official Gemini CLI.".to_string(),
                    details: {
                        let mut details = vec![
                            "Gemini CLI uses local Google login / Gemini Code Assist setup, not API keys, by default.".to_string(),
                            "Some Google account types may still require project or IAM setup outside Divergence.".to_string(),
                        ];
                        if stream_json_supported {
                            details.push(
                                "This installed binary supports stream-json output, so Divergence can capture structured assistant deltas.".to_string(),
                            );
                        } else {
                            details.push(
                                "This installed binary does not advertise stream-json output, so Divergence falls back to text-first session updates.".to_string(),
                            );
                        }
                        details
                    },
                    binary_candidates: vec!["gemini".to_string()],
                    detected_command: Some(command),
                    auth_status: AgentRuntimeProviderAuthStatus::Unknown,
                }
            } else {
                AgentRuntimeProviderReadiness {
                    status: AgentRuntimeProviderReadinessStatus::SetupRequired,
                    summary: "Gemini CLI not found.".to_string(),
                    details: vec![
                        "Install Gemini CLI and authenticate it locally before using Gemini sessions.".to_string(),
                    ],
                    binary_candidates: vec!["gemini".to_string()],
                    detected_command: None,
                    auth_status: AgentRuntimeProviderAuthStatus::Missing,
                }
            }
        }
    }
}
