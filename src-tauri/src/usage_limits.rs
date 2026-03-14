use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::path::PathBuf;

// ── Response types ──────────────────────────────────────────────────────────

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UsageWindow {
    pub utilization: f64,
    pub resets_at: Option<String>,
    pub label: String,
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

fn get_codex_auth_path() -> Option<PathBuf> {
    if let Ok(codex_home) = std::env::var("CODEX_HOME") {
        let p = PathBuf::from(codex_home).join("auth.json");
        if p.exists() {
            return Some(p);
        }
    }
    dirs::home_dir().map(|h| h.join(".codex").join("auth.json"))
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
    if let Some(additional) = body
        .get("additional_rate_limits")
        .and_then(|v| v.as_array())
    {
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
