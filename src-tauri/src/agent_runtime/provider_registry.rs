use super::*;

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
                    slug: DEFAULT_CLAUDE_MODEL.to_string(),
                    label: "Sonnet".to_string(),
                },
                AgentRuntimeModelOption {
                    slug: "opus".to_string(),
                    label: "Opus".to_string(),
                },
                AgentRuntimeModelOption {
                    slug: "claude-sonnet-4-6".to_string(),
                    label: "Claude Sonnet 4.6".to_string(),
                },
                AgentRuntimeModelOption {
                    slug: "claude-opus-4-1".to_string(),
                    label: "Claude Opus 4.1".to_string(),
                },
            ],
            readiness: provider_readiness(&AgentProvider::Claude),
            features: AgentRuntimeProviderFeatures {
                streaming: true,
                resume: true,
                structured_requests: false,
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

pub(super) fn build_claude_command(
    session: &AgentSessionSnapshot,
    claude_oauth_token: &str,
) -> Command {
    let mut command = Command::new("claude");
    command
        .arg("-p")
        .arg("--verbose")
        .arg("--output-format")
        .arg("stream-json")
        .arg("--include-partial-messages")
        .arg("--dangerously-skip-permissions");
    if !session.model.trim().is_empty() {
        command.arg("--model").arg(session.model.trim());
    }
    if let Some(thread_id) = session.thread_id.as_deref() {
        command.arg("--resume").arg(thread_id);
    }
    if !claude_oauth_token.trim().is_empty() {
        command.env("CLAUDE_CODE_OAUTH_TOKEN", claude_oauth_token.trim());
    }
    command
}

pub(super) fn build_cursor_command(
    session: &AgentSessionSnapshot,
    prompt: &str,
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

    if let Some(thread_id) = session.thread_id.as_deref() {
        command.arg("--resume").arg(thread_id);
    }

    command.arg(prompt);
    Ok(command)
}

pub(super) fn build_gemini_command(
    session: &AgentSessionSnapshot,
    prompt: &str,
) -> Result<Command, String> {
    let binary = detect_gemini_binary().ok_or_else(|| {
        "Gemini CLI was not found. Install gemini and log in with a supported Google account before starting a Gemini session."
            .to_string()
    })?;

    let mut command = Command::new(binary);
    command.arg("-p").arg(build_history_context_prompt(session, prompt));
    if gemini_supports_stream_json() {
        command.arg("--output-format").arg("stream-json");
    }
    command.arg("-m").arg(session.model.trim()).arg("-y");
    Ok(command)
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

    for line in stdout.lines().map(str::trim).filter(|line| !line.is_empty()) {
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

    if !model_options.iter().any(|option| option.slug == default_model) {
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
            (output.status.success(), (!trimmed.is_empty()).then_some(trimmed))
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
            !(matches!(message.role, AgentMessageRole::User) && message.content.trim() == prompt.trim())
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
                    summary: "Claude CLI detected. Divergence assumes local login or OAuth token setup.".to_string(),
                    details: vec![
                        "Use the official Claude CLI login flow for subscription-backed access.".to_string(),
                        "Automations can still use the stored Claude OAuth token when needed.".to_string(),
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
                        "Install Claude Code CLI and log in locally before using Claude sessions.".to_string(),
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
