use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::path::PathBuf;
#[cfg(target_os = "macos")]
use std::process::Command;

// ── Response types ──────────────────────────────────────────────────────────

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UsageLimitsStatus {
    pub claude_credentials_found: bool,
    pub codex_credentials_found: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UsageWindow {
    pub utilization: f64,
    pub resets_at: Option<String>,
    pub label: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClaudeUsageResult {
    pub available: bool,
    pub error: Option<String>,
    pub windows: Vec<UsageWindow>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CodexUsageResult {
    pub available: bool,
    pub error: Option<String>,
    pub plan_type: Option<String>,
    pub windows: Vec<UsageWindow>,
}

// ── Credential structures ───────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ClaudeCredentials {
    claude_ai_oauth: Option<ClaudeOAuth>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ClaudeOAuth {
    access_token: String,
    refresh_token: Option<String>,
    expires_at: Option<Value>,
}

#[derive(Debug, Deserialize)]
struct CodexAuthFile {
    tokens: Option<CodexTokens>,
}

#[derive(Debug, Deserialize)]
struct CodexTokens {
    access_token: String,
    refresh_token: Option<String>,
    account_id: Option<String>,
}

// ── Token refresh response ──────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
struct OAuthTokenResponse {
    access_token: String,
}

// ── Tauri commands ──────────────────────────────────────────────────────────

#[tauri::command]
pub async fn get_usage_limits_status(claude_oauth_token: Option<String>) -> Result<UsageLimitsStatus, String> {
    let claude_found = normalize_claude_auth_token(claude_oauth_token).is_some()
        || read_claude_oauth_token_from_env().is_some()
        || read_claude_keychain().is_some()
        || get_claude_credentials_path().is_some_and(|p| p.exists());
    let codex_found = get_codex_auth_path().is_some_and(|p| p.exists());

    Ok(UsageLimitsStatus {
        claude_credentials_found: claude_found,
        codex_credentials_found: codex_found,
    })
}

#[tauri::command]
pub async fn fetch_claude_usage(
    claude_oauth_token: Option<String>,
) -> Result<ClaudeUsageResult, String> {
    let (access_token, token_source) = if let Some(token) = normalize_claude_auth_token(claude_oauth_token) {
        (
            resolve_claude_supplied_token(token).await,
            "settings token".to_string(),
        )
    } else if let Some(token) = read_claude_oauth_token_from_env() {
        (
            resolve_claude_supplied_token(token).await,
            "CLAUDE_CODE_OAUTH_TOKEN".to_string(),
        )
    } else {
        let content = match load_claude_credentials_json() {
            Some(c) => c,
            None => {
                return Ok(ClaudeUsageResult {
                    available: false,
                    error: Some("Claude credentials not found (checked settings token, CLAUDE_CODE_OAUTH_TOKEN, Keychain, and ~/.claude/.credentials.json)".into()),
                    windows: vec![],
                });
            }
        };

        let creds: ClaudeCredentials = match serde_json::from_str(&content) {
            Ok(c) => c,
            Err(e) => {
                return Ok(ClaudeUsageResult {
                    available: false,
                    error: Some(format!("Failed to parse credentials: {e}")),
                    windows: vec![],
                });
            }
        };

        let oauth = match creds.claude_ai_oauth {
            Some(o) => o,
            None => {
                return Ok(ClaudeUsageResult {
                    available: false,
                    error: Some("No claudeAiOauth in credentials".into()),
                    windows: vec![],
                });
            }
        };

        (
            resolve_claude_token(&oauth).await?,
            "Claude keychain/credentials".to_string(),
        )
    };

    let client = Client::new();
    let resp = client
        .get("https://api.anthropic.com/api/oauth/usage")
        .header("Authorization", format!("Bearer {access_token}"))
        .header("Accept", "application/json")
        .header("Content-Type", "application/json")
        .header("anthropic-beta", "oauth-2025-04-20")
        .header("User-Agent", "divergence-app")
        .send()
        .await
        .map_err(|e| format!("Claude API request failed: {e}"))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();

        let error_msg = if status.as_u16() == 403
            && (body.contains("permission_error") || body.contains("scope"))
        {
            format!(
                "Usage data unavailable: your OAuth token lacks the required \
                 user:profile scope (using {token_source}). Tokens from \
                 `claude setup-token` only include user:inference. This is a \
                 known upstream limitation \
                 (github.com/anthropics/claude-code/issues/11985). Run \
                 `claude login` in a terminal for a token with full scopes, \
                 but note this may invalidate your long-lived automation token."
            )
        } else {
            format!("Claude API returned {status} (using {token_source}): {body}")
        };

        return Ok(ClaudeUsageResult {
            available: false,
            error: Some(error_msg),
            windows: vec![],
        });
    }

    let body: Value = resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse Claude usage response: {e}"))?;

    let windows = parse_claude_windows(&body);

    Ok(ClaudeUsageResult {
        available: true,
        error: None,
        windows,
    })
}

#[tauri::command]
pub async fn fetch_codex_usage() -> Result<CodexUsageResult, String> {
    let auth_path = match get_codex_auth_path() {
        Some(p) if p.exists() => p,
        _ => {
            return Ok(CodexUsageResult {
                available: false,
                error: Some("Codex auth file not found".into()),
                plan_type: None,
                windows: vec![],
            });
        }
    };

    let content = match std::fs::read_to_string(&auth_path) {
        Ok(c) => c,
        Err(e) => {
            return Ok(CodexUsageResult {
                available: false,
                error: Some(format!("Failed to read auth file: {e}")),
                plan_type: None,
                windows: vec![],
            });
        }
    };

    let auth: CodexAuthFile = match serde_json::from_str(&content) {
        Ok(a) => a,
        Err(e) => {
            return Ok(CodexUsageResult {
                available: false,
                error: Some(format!("Failed to parse auth file: {e}")),
                plan_type: None,
                windows: vec![],
            });
        }
    };

    let tokens = match auth.tokens {
        Some(t) => t,
        None => {
            return Ok(CodexUsageResult {
                available: false,
                error: Some("No tokens found in auth file".into()),
                plan_type: None,
                windows: vec![],
            });
        }
    };

    let access_token = resolve_codex_token(&tokens).await?;

    let client = Client::new();
    let mut req = client
        .get("https://chatgpt.com/backend-api/wham/usage")
        .header("Authorization", format!("Bearer {access_token}"))
        .header("Accept", "application/json")
        .header("User-Agent", "divergence-app");

    if let Some(ref account_id) = tokens.account_id {
        req = req.header("ChatGPT-Account-Id", account_id);
    }

    let resp = req
        .send()
        .await
        .map_err(|e| format!("Codex API request failed: {e}"))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Ok(CodexUsageResult {
            available: false,
            error: Some(format!("Codex API returned {status}: {body}")),
            plan_type: None,
            windows: vec![],
        });
    }

    let body: Value = resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse Codex usage response: {e}"))?;

    let plan_type = body
        .get("plan_type")
        .and_then(|v| v.as_str())
        .map(String::from);
    let windows = parse_codex_windows(&body);

    Ok(CodexUsageResult {
        available: true,
        error: None,
        plan_type,
        windows,
    })
}

// ── Helpers ─────────────────────────────────────────────────────────────────

fn normalize_non_empty_token(token: Option<String>) -> Option<String> {
    token.and_then(|value| {
        let trimmed = value.trim().to_string();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed)
        }
    })
}

fn normalize_claude_auth_token(token: Option<String>) -> Option<String> {
    let token = normalize_non_empty_token(token)?;
    let normalized = if token
        .get(..7)
        .is_some_and(|prefix| prefix.eq_ignore_ascii_case("bearer "))
    {
        token[7..].trim().to_string()
    } else {
        token
    };
    if normalized.is_empty() {
        None
    } else {
        Some(normalized)
    }
}

fn read_claude_oauth_token_from_env() -> Option<String> {
    normalize_claude_auth_token(std::env::var("CLAUDE_CODE_OAUTH_TOKEN").ok())
}

#[cfg(target_os = "macos")]
fn read_claude_keychain() -> Option<String> {
    let output = Command::new("security")
        .args(["find-generic-password", "-s", "Claude Code-credentials", "-w"])
        .output()
        .ok()?;

    if output.status.success() {
        let s = String::from_utf8(output.stdout).ok()?;
        let trimmed = s.trim().to_string();
        if !trimmed.is_empty() {
            return Some(trimmed);
        }
    }
    None
}

#[cfg(not(target_os = "macos"))]
fn read_claude_keychain() -> Option<String> {
    None
}

fn get_claude_credentials_path() -> Option<PathBuf> {
    dirs::home_dir().map(|h| h.join(".claude").join(".credentials.json"))
}

/// Load Claude credentials JSON: try Keychain first, then fall back to file.
fn load_claude_credentials_json() -> Option<String> {
    if let Some(json) = read_claude_keychain() {
        return Some(json);
    }
    let path = get_claude_credentials_path()?;
    std::fs::read_to_string(path).ok()
}

fn get_codex_auth_path() -> Option<PathBuf> {
    if let Ok(codex_home) = std::env::var("CODEX_HOME") {
        let p = PathBuf::from(codex_home).join("auth.json");
        if p.exists() {
            return Some(p);
        }
    }
    dirs::home_dir().map(|h| h.join(".codex").join("auth.json"))
}

async fn resolve_claude_token(oauth: &ClaudeOAuth) -> Result<String, String> {
    // expiresAt can be milliseconds (number) or ISO 8601 string
    let is_expired = match &oauth.expires_at {
        Some(Value::Number(n)) => {
            if let Some(ms) = n.as_i64() {
                let now_ms = chrono::Utc::now().timestamp_millis();
                now_ms >= ms
            } else {
                true
            }
        }
        Some(Value::String(s)) => {
            if let Ok(dt) = chrono::DateTime::parse_from_rfc3339(s) {
                chrono::Utc::now() >= dt
            } else {
                true
            }
        }
        _ => true,
    };

    if !is_expired {
        return Ok(oauth.access_token.clone());
    }

    let refresh_token = match &oauth.refresh_token {
        Some(rt) => rt,
        None => return Ok(oauth.access_token.clone()),
    };

    if let Some(token) = refresh_claude_access_token(refresh_token).await? {
        return Ok(token);
    }

    // Fall back to existing token if refresh fails.
    Ok(oauth.access_token.clone())
}

async fn resolve_claude_supplied_token(token: String) -> String {
    match refresh_claude_access_token(&token).await {
        Ok(Some(access_token)) => access_token,
        _ => token,
    }
}

async fn refresh_claude_access_token(refresh_token: &str) -> Result<Option<String>, String> {
    let client = Client::new();
    let resp = client
        .post("https://platform.claude.com/v1/oauth/token")
        .form(&[
            ("client_id", "9d1c250a-e61b-44d9-88ed-5944d1962f5e"),
            ("grant_type", "refresh_token"),
            ("refresh_token", refresh_token),
        ])
        .send()
        .await
        .map_err(|e| format!("Claude token refresh failed: {e}"))?;

    if !resp.status().is_success() {
        return Ok(None);
    }

    let token_resp: OAuthTokenResponse = resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse token refresh response: {e}"))?;

    Ok(Some(token_resp.access_token))
}

async fn resolve_codex_token(tokens: &CodexTokens) -> Result<String, String> {
    let refresh_token = match &tokens.refresh_token {
        Some(rt) => rt,
        None => return Ok(tokens.access_token.clone()),
    };

    let client = Client::new();
    let resp = client
        .post("https://auth.openai.com/oauth/token")
        .form(&[
            ("client_id", "app_EMoamEEZ73f0CkXaXp7hrann"),
            ("grant_type", "refresh_token"),
            ("refresh_token", refresh_token.as_str()),
        ])
        .send()
        .await
        .map_err(|e| format!("Codex token refresh failed: {e}"))?;

    if !resp.status().is_success() {
        return Ok(tokens.access_token.clone());
    }

    let token_resp: OAuthTokenResponse = resp
        .json()
        .await
        .map_err(|e| format!("Failed to parse Codex token refresh response: {e}"))?;

    Ok(token_resp.access_token)
}

fn parse_claude_windows(body: &Value) -> Vec<UsageWindow> {
    let mut windows = Vec::new();

    // API returns snake_case keys; utilization is a percentage (0-100)
    let window_keys = [
        ("five_hour", "Session (5h)"),
        ("seven_day", "Weekly"),
        ("seven_day_sonnet", "Weekly Sonnet"),
        ("seven_day_opus", "Weekly Opus"),
        ("seven_day_oauth_apps", "Weekly OAuth"),
        ("seven_day_cowork", "Weekly Cowork"),
        ("iguana_necktie", "Iguana Necktie"),
    ];

    for (key, label) in &window_keys {
        if let Some(window) = body.get(key) {
            if window.is_null() {
                continue;
            }
            let utilization_pct = window
                .get("utilization")
                .and_then(|v| v.as_f64())
                .unwrap_or(0.0);
            let resets_at = window
                .get("resets_at")
                .and_then(|v| v.as_str())
                .map(String::from);
            windows.push(UsageWindow {
                utilization: utilization_pct / 100.0,
                resets_at,
                label: label.to_string(),
            });
        }
    }

    windows
}

/// Convert a Unix timestamp (seconds) to an ISO 8601 string.
fn unix_ts_to_iso(ts: i64) -> String {
    chrono::DateTime::from_timestamp(ts, 0)
        .map(|dt| dt.to_rfc3339())
        .unwrap_or_default()
}

fn parse_codex_rate_limit_windows(
    rate_limit: &Value,
    prefix: &str,
    windows: &mut Vec<UsageWindow>,
) {
    let window_keys = [
        ("primary_window", "Primary"),
        ("secondary_window", "Secondary"),
    ];

    for (key, base_label) in &window_keys {
        if let Some(window) = rate_limit.get(key) {
            if window.is_null() {
                continue;
            }
            let used_percent = window
                .get("used_percent")
                .and_then(|v| v.as_f64())
                .unwrap_or(0.0);
            let reset_at = window
                .get("reset_at")
                .and_then(|v| v.as_i64())
                .map(unix_ts_to_iso);
            let label = if prefix.is_empty() {
                base_label.to_string()
            } else {
                format!("{prefix} {base_label}")
            };
            windows.push(UsageWindow {
                utilization: used_percent / 100.0,
                resets_at: reset_at,
                label,
            });
        }
    }
}

fn parse_codex_windows(body: &Value) -> Vec<UsageWindow> {
    let mut windows = Vec::new();

    // Main rate limit
    if let Some(rate_limit) = body.get("rate_limit") {
        parse_codex_rate_limit_windows(rate_limit, "", &mut windows);
    }

    // Additional rate limits (e.g. GPT-5.3-Codex-Spark)
    if let Some(additional) = body.get("additional_rate_limits").and_then(|v| v.as_array()) {
        for entry in additional {
            let name = entry
                .get("limit_name")
                .and_then(|v| v.as_str())
                .unwrap_or("Extra");
            if let Some(rl) = entry.get("rate_limit") {
                parse_codex_rate_limit_windows(rl, name, &mut windows);
            }
        }
    }

    windows
}
