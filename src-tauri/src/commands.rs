use crate::db::{get_divergence_dir, get_repos_dir, get_workspaces_dir};
use crate::git;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::Instant;
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Project {
    pub id: i64,
    pub name: String,
    pub path: String,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Divergence {
    pub id: i64,
    pub project_id: i64,
    pub name: String,
    pub branch: String,
    pub path: String,
    pub created_at: String,
    pub has_diverged: bool,
}

fn path_to_string(path: &Path) -> String {
    path.to_string_lossy().into_owned()
}

#[tauri::command]
pub async fn add_project(name: String, path: String) -> Result<Project, String> {
    // Verify path exists
    let project_path = PathBuf::from(&path);
    if !project_path.exists() {
        return Err(format!("Path does not exist: {}", path));
    }

    // Return a project object (actual DB insertion happens in frontend with tauri-plugin-sql)
    Ok(Project {
        id: 0, // Will be set by database
        name,
        path,
        created_at: chrono::Utc::now().to_rfc3339(),
    })
}

#[tauri::command]
pub async fn remove_project(_id: i64) -> Result<(), String> {
    // Database deletion handled by frontend
    // This command can be used for any cleanup if needed
    Ok(())
}

#[tauri::command]
pub async fn list_projects() -> Result<Vec<Project>, String> {
    // Database query handled by frontend with tauri-plugin-sql
    Ok(vec![])
}

#[tauri::command]
pub async fn create_divergence(
    project_id: i64,
    project_name: String,
    project_path: String,
    branch_name: String,
    copy_ignored_skip: Vec<String>,
    use_existing_branch: bool,
) -> Result<Divergence, String> {
    let source_path = PathBuf::from(&project_path);

    // Verify source is a git repo
    if !git::is_git_repo(&source_path) {
        return Err("Project is not a git repository".to_string());
    }

    // Generate unique path for divergence
    let short_uuid = &Uuid::new_v4().to_string()[..8];
    let safe_project_name = project_name.replace(' ', "-").to_lowercase();
    let safe_branch_name = branch_name.replace(['/', ' '], "-");
    let divergence_dir_name = format!("{}-{}-{}", safe_project_name, safe_branch_name, short_uuid);
    let divergence_path = get_repos_dir().join(&divergence_dir_name);

    // Clone the repository
    git::clone_repo(&source_path, &divergence_path)?;

    // Update origin to the original remote (if present)
    git::set_origin_to_source_remote(&source_path, &divergence_path)?;

    // Checkout branch (existing or new)
    if use_existing_branch {
        git::checkout_existing_branch(&divergence_path, &branch_name)?;
    } else {
        git::checkout_branch(&divergence_path, &branch_name, true)?;
    }

    // Copy ignored files (e.g., .env) from source into the divergence clone
    git::copy_ignored_paths(&source_path, &divergence_path, &copy_ignored_skip)?;

    Ok(Divergence {
        id: 0, // Will be set by database
        project_id,
        name: divergence_dir_name,
        branch: branch_name,
        path: path_to_string(&divergence_path),
        created_at: chrono::Utc::now().to_rfc3339(),
        has_diverged: false,
    })
}

#[tauri::command]
pub async fn list_divergences(_project_id: i64) -> Result<Vec<Divergence>, String> {
    // Database query handled by frontend
    Ok(vec![])
}

#[tauri::command]
pub async fn list_remote_branches(path: String) -> Result<Vec<String>, String> {
    let repo_path = PathBuf::from(&path);
    git::list_remote_branches(&repo_path)
}

#[tauri::command]
pub async fn delete_divergence(path: String) -> Result<(), String> {
    let divergence_path = PathBuf::from(&path);

    // Verify path is within our repos directory for safety
    let repos_dir = get_repos_dir();
    if !divergence_path.starts_with(&repos_dir) {
        return Err("Cannot delete path outside of divergence repos directory".to_string());
    }

    // Remove the directory
    if divergence_path.exists() {
        let delete_path = divergence_path.clone();
        let started_at = Instant::now();
        tauri::async_runtime::spawn_blocking(move || fs::remove_dir_all(&delete_path))
            .await
            .map_err(|e| format!("Failed to delete divergence directory: {}", e))?
            .map_err(|e| format!("Failed to delete divergence directory: {}", e))?;
        let elapsed = started_at.elapsed();
        println!("Deleted divergence at '{}' in {} ms", path, elapsed.as_millis());
    }

    Ok(())
}

#[tauri::command]
pub async fn get_ralphy_config_summary(project_path: String) -> Result<RalphyConfigResponse, String> {
    let config_path = PathBuf::from(&project_path)
        .join(".ralphy")
        .join("config.json");
    let path_string = path_to_string(&config_path);

    if !config_path.exists() {
        return Ok(RalphyConfigResponse::Missing { path: path_string });
    }

    let contents = match fs::read_to_string(&config_path) {
        Ok(value) => value,
        Err(err) => {
            return Ok(RalphyConfigResponse::Invalid {
                path: path_string,
                error: format!("Failed to read config: {}", err),
            });
        }
    };

    let value: Value = match serde_json::from_str(&contents) {
        Ok(value) => value,
        Err(err) => {
            return Ok(RalphyConfigResponse::Invalid {
                path: path_string,
                error: format!("Failed to parse JSON: {}", err),
            });
        }
    };

    let version = number_at(&value, &["version"]);
    let mut provider_type = None;
    let mut project_name = None;
    let mut project_key = None;
    let mut project_id = None;
    let mut team_id = None;
    let mut labels_value: Option<&Value> = None;

    if version == Some(2) || value.get("provider").is_some() {
        provider_type = string_at(&value, &["provider", "type"]);
        project_name = string_at(&value, &["provider", "config", "projectName"]);
        project_key = string_at(&value, &["provider", "config", "projectKey"]);
        project_id = string_at(&value, &["provider", "config", "projectId"]);
        team_id = string_at(&value, &["provider", "config", "teamId"]);
        labels_value = value.get("labels");
    } else if version == Some(1) || value.get("linear").is_some() {
        provider_type = Some("linear".to_string());
        project_name = string_at(&value, &["linear", "projectName"]);
        project_id = string_at(&value, &["linear", "projectId"]);
        team_id = string_at(&value, &["linear", "teamId"]);
        labels_value = value.get("linear").and_then(|linear| linear.get("labels"));
    }

    let summary = RalphyConfigSummary {
        version,
        provider_type,
        project_name,
        project_key,
        project_id,
        team_id,
        labels: build_labels_summary(labels_value),
        claude: build_claude_summary(value.get("claude")),
        integrations: build_integrations_summary(value.get("integrations")),
    };

    Ok(RalphyConfigResponse::Ok {
        path: path_string,
        summary: Box::new(summary),
    })
}

#[tauri::command]
pub async fn fetch_github_pull_requests(
    owner: String,
    repo: String,
) -> Result<Vec<GithubPullRequestEvent>, String> {
    let owner = owner.trim();
    let repo = repo.trim();
    if owner.is_empty() || repo.is_empty() {
        return Err("owner and repo are required".to_string());
    }

    let token = std::env::var("GITHUB_TOKEN")
        .or_else(|_| std::env::var("github_token"))
        .map_err(|_| "GITHUB_TOKEN environment variable is not set.".to_string())?;
    if token.trim().is_empty() {
        return Err("GITHUB_TOKEN environment variable is not set.".to_string());
    }

    let client = reqwest::Client::new();
    let url = format!("https://api.github.com/repos/{}/{}/pulls", owner, repo);
    let response = client
        .get(url)
        .header(reqwest::header::AUTHORIZATION, format!("Bearer {}", token.trim()))
        .header(reqwest::header::USER_AGENT, "divergence-app")
        .header(reqwest::header::ACCEPT, "application/vnd.github+json")
        .header("X-GitHub-Api-Version", "2022-11-28")
        .query(&[
            ("state", "open"),
            ("sort", "updated"),
            ("direction", "desc"),
            ("per_page", "100"),
        ])
        .send()
        .await
        .map_err(|error| format!("Failed to query GitHub: {}", error))?;

    let status = response.status();
    if !status.is_success() {
        let response_body = response
            .text()
            .await
            .unwrap_or_else(|_| String::new())
            .chars()
            .take(400)
            .collect::<String>();
        return Err(format!(
            "GitHub API request failed with status {}: {}",
            status.as_u16(),
            response_body
        ));
    }

    let items = response
        .json::<Vec<GithubPullRequestApiItem>>()
        .await
        .map_err(|error| format!("Failed to parse GitHub response: {}", error))?;

    let mut events = Vec::with_capacity(items.len());
    for item in items {
        let created_at_ms = parse_rfc3339_millis(&item.created_at, "GitHub timestamp")?;
        let updated_at_ms = parse_rfc3339_millis(&item.updated_at, "GitHub timestamp")?;
        events.push(GithubPullRequestEvent {
            id: item.id,
            number: item.number,
            title: item.title,
            html_url: item.html_url,
            user_login: item.user.and_then(|user| user.login),
            created_at_ms,
            updated_at_ms,
        });
    }

    Ok(events)
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BranchStatus {
    pub merged: bool,
    pub diverged: bool,
}

#[derive(Debug, Serialize)]
pub struct GitChangeEntry {
    pub path: String,
    pub old_path: Option<String>,
    pub status: String,
    pub staged: bool,
    pub unstaged: bool,
    pub untracked: bool,
}

#[derive(Debug, Serialize)]
pub struct GitDiffResponse {
    pub diff: String,
    pub is_binary: bool,
}

#[derive(Debug, Serialize)]
pub struct BranchChangesResponse {
    pub base_ref: Option<String>,
    pub changes: Vec<GitChangeEntry>,
}

#[derive(Debug, Serialize)]
pub struct WriteReviewBriefResponse {
    pub path: String,
}

#[derive(Debug, Deserialize)]
struct GithubPullRequestApiUser {
    login: Option<String>,
}

#[derive(Debug, Deserialize)]
struct GithubPullRequestApiItem {
    id: i64,
    number: i64,
    title: String,
    html_url: String,
    user: Option<GithubPullRequestApiUser>,
    created_at: String,
    updated_at: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GithubPullRequestEvent {
    pub id: i64,
    pub number: i64,
    pub title: String,
    pub html_url: String,
    pub user_login: Option<String>,
    pub created_at_ms: i64,
    pub updated_at_ms: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LinearProjectIssue {
    pub id: String,
    pub identifier: String,
    pub title: String,
    pub description: Option<String>,
    pub state_name: Option<String>,
    pub state_type: Option<String>,
    pub assignee_name: Option<String>,
    pub url: Option<String>,
    pub updated_at_ms: Option<i64>,
}

#[derive(Debug, Deserialize)]
struct LinearGraphqlResponse {
    data: Option<LinearGraphqlData>,
    errors: Option<Vec<LinearGraphqlError>>,
}

#[derive(Debug, Deserialize)]
struct LinearGraphqlError {
    message: String,
}

#[derive(Debug, Deserialize)]
struct LinearGraphqlData {
    project: Option<LinearProjectNode>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct LinearProjectNode {
    issues: LinearIssueConnection,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct LinearIssueConnection {
    nodes: Vec<LinearIssueNode>,
    page_info: LinearPageInfo,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct LinearPageInfo {
    has_next_page: bool,
    end_cursor: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct LinearIssueNode {
    id: String,
    identifier: String,
    title: String,
    description: Option<String>,
    url: Option<String>,
    updated_at: Option<String>,
    state: Option<LinearIssueStateNode>,
    assignee: Option<LinearIssueAssigneeNode>,
}

#[derive(Debug, Deserialize)]
struct LinearIssueStateNode {
    name: Option<String>,
    #[serde(rename = "type")]
    issue_type: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct LinearIssueAssigneeNode {
    name: Option<String>,
    display_name: Option<String>,
}

const LINEAR_GRAPHQL_URL: &str = "https://api.linear.app/graphql";
const LINEAR_GRAPHQL_QUERY: &str = r#"
query ProjectIssues($projectId: String!, $first: Int!, $after: String) {
  project(id: $projectId) {
    issues(first: $first, after: $after) {
      nodes {
        id
        identifier
        title
        description
        url
        updatedAt
        state {
          name
          type
        }
        assignee {
          name
          displayName
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
}
"#;
const LINEAR_PAGE_SIZE: usize = 100;
const LINEAR_MAX_PAGES: usize = 30;

#[tauri::command]
pub async fn fetch_linear_project_issues(
    token: String,
    project_id: String,
) -> Result<Vec<LinearProjectIssue>, String> {
    let token = token.trim();
    if token.is_empty() {
        return Err("Linear API token is required.".to_string());
    }

    let project_id = project_id.trim();
    if project_id.is_empty() {
        return Err("Linear project ID is required.".to_string());
    }

    let token = token
        .strip_prefix("Bearer ")
        .or_else(|| token.strip_prefix("bearer "))
        .unwrap_or(token);

    let client = reqwest::Client::new();
    let mut issues: Vec<LinearProjectIssue> = Vec::new();
    let mut after: Option<String> = None;
    let mut reached_end = false;

    for _ in 0..LINEAR_MAX_PAGES {
        let payload = serde_json::json!({
            "query": LINEAR_GRAPHQL_QUERY,
            "variables": {
                "projectId": project_id,
                "first": LINEAR_PAGE_SIZE,
                "after": after,
            }
        });
        let request_body = payload.to_string();

        let response = client
            .post(LINEAR_GRAPHQL_URL)
            .header(reqwest::header::AUTHORIZATION, token)
            .header(reqwest::header::CONTENT_TYPE, "application/json")
            .header(reqwest::header::ACCEPT, "application/json")
            .body(request_body)
            .send()
            .await
            .map_err(|error| format!("Failed to query Linear: {}", error))?;

        let status = response.status();
        let response_body = response
            .text()
            .await
            .unwrap_or_else(|_| String::new());

        if !status.is_success() {
            let linear_message = extract_linear_error_message(&response_body)
                .unwrap_or_else(|| response_body.chars().take(400).collect::<String>());
            return Err(format!(
                "Linear API request failed with status {}: {}",
                status.as_u16(),
                linear_message
            ));
        }

        let payload = serde_json::from_str::<LinearGraphqlResponse>(&response_body)
            .map_err(|error| format!("Failed to parse Linear response: {}", error))?;

        if let Some(errors) = payload.errors {
            if !errors.is_empty() {
                let message = errors
                    .into_iter()
                    .map(|error| error.message)
                    .collect::<Vec<_>>()
                    .join("; ");
                return Err(format!("Linear API returned errors: {}", message));
            }
        }

        let data = payload
            .data
            .ok_or_else(|| "Linear response did not include data.".to_string())?;
        let project = data.project.ok_or_else(|| {
            format!("Linear project '{}' was not found or is not accessible.", project_id)
        })?;
        let LinearIssueConnection { nodes, page_info } = project.issues;

        for issue in nodes {
            let assignee_name = issue
                .assignee
                .and_then(|assignee| {
                    let display_name = assignee.display_name.and_then(|value| {
                        let trimmed = value.trim();
                        if trimmed.is_empty() {
                            None
                        } else {
                            Some(trimmed.to_string())
                        }
                    });
                    if display_name.is_some() {
                        return display_name;
                    }
                    assignee.name.and_then(|value| {
                        let trimmed = value.trim();
                        if trimmed.is_empty() {
                            None
                        } else {
                            Some(trimmed.to_string())
                        }
                    })
                });

            let updated_at_ms = issue
                .updated_at
                .as_deref()
                .and_then(|value| parse_rfc3339_millis(value, "Linear timestamp").ok());

            issues.push(LinearProjectIssue {
                id: issue.id,
                identifier: issue.identifier,
                title: issue.title,
                description: issue.description,
                state_name: issue.state.as_ref().and_then(|state| state.name.clone()),
                state_type: issue.state.as_ref().and_then(|state| state.issue_type.clone()),
                assignee_name,
                url: issue.url,
                updated_at_ms,
            });
        }

        if !page_info.has_next_page {
            reached_end = true;
            break;
        }

        after = page_info.end_cursor;
        if after.is_none() {
            reached_end = true;
            break;
        }
    }

    if !reached_end {
        return Err(format!(
            "Linear project has too many issues to fetch at once (limit: {}).",
            LINEAR_PAGE_SIZE * LINEAR_MAX_PAGES
        ));
    }

    issues.sort_by(|left, right| {
        (right.updated_at_ms.unwrap_or(0))
            .cmp(&left.updated_at_ms.unwrap_or(0))
            .then_with(|| left.identifier.cmp(&right.identifier))
    });

    Ok(issues)
}

fn extract_linear_error_message(response_body: &str) -> Option<String> {
    let parsed = serde_json::from_str::<Value>(response_body).ok()?;

    if let Some(errors) = parsed.get("errors").and_then(|value| value.as_array()) {
        let mut messages: Vec<String> = Vec::new();
        for error in errors {
            if let Some(message) = error.get("message").and_then(|value| value.as_str()) {
                let trimmed = message.trim();
                if !trimmed.is_empty() {
                    messages.push(trimmed.to_string());
                }
            }
        }

        if !messages.is_empty() {
            return Some(messages.join("; "));
        }
    }

    parsed.get("message")
        .and_then(|value| value.as_str())
        .map(|value| value.trim())
        .filter(|value| !value.is_empty())
        .map(|value| value.to_string())
}

fn parse_rfc3339_millis(value: &str, context: &str) -> Result<i64, String> {
    chrono::DateTime::parse_from_rfc3339(value)
        .map(|date| date.timestamp_millis())
        .map_err(|error| format!("Failed to parse {} '{}': {}", context, value, error))
}

fn value_at<'a>(value: &'a Value, path: &[&str]) -> Option<&'a Value> {
    let mut current = value;
    for key in path {
        current = current.get(*key)?;
    }
    Some(current)
}

fn string_at(value: &Value, path: &[&str]) -> Option<String> {
    value_at(value, path)
        .and_then(|v| v.as_str())
        .map(|v| v.to_string())
}

fn number_at(value: &Value, path: &[&str]) -> Option<i64> {
    value_at(value, path).and_then(|v| v.as_i64())
}

fn build_labels_summary(value: Option<&Value>) -> Option<RalphyLabelsSummary> {
    let labels = value?;
    let summary = RalphyLabelsSummary {
        candidate: labels.get("candidate").and_then(|v| v.as_str()).map(|v| v.to_string()),
        ready: labels.get("ready").and_then(|v| v.as_str()).map(|v| v.to_string()),
        enriched: labels.get("enriched").and_then(|v| v.as_str()).map(|v| v.to_string()),
        pr_feedback: labels.get("prFeedback").and_then(|v| v.as_str()).map(|v| v.to_string()),
    };

    if summary.candidate.is_none()
        && summary.ready.is_none()
        && summary.enriched.is_none()
        && summary.pr_feedback.is_none()
    {
        None
    } else {
        Some(summary)
    }
}

fn build_claude_summary(value: Option<&Value>) -> Option<RalphyClaudeSummary> {
    let claude = value?;
    let summary = RalphyClaudeSummary {
        max_iterations: claude.get("maxIterations").and_then(|v| v.as_i64()),
        timeout: claude.get("timeout").and_then(|v| v.as_i64()),
        model: claude.get("model").and_then(|v| v.as_str()).map(|v| v.to_string()),
    };

    if summary.max_iterations.is_none() && summary.timeout.is_none() && summary.model.is_none() {
        None
    } else {
        Some(summary)
    }
}

fn build_integrations_summary(value: Option<&Value>) -> Option<RalphyIntegrationsSummary> {
    let integrations = value?;
    let github_value = integrations.get("github");
    let github = github_value.and_then(|github| {
        let summary = RalphyGithubIntegrationSummary {
            owner: github.get("owner").and_then(|v| v.as_str()).map(|v| v.to_string()),
            repo: github.get("repo").and_then(|v| v.as_str()).map(|v| v.to_string()),
        };

        if summary.owner.is_none() && summary.repo.is_none() {
            None
        } else {
            Some(summary)
        }
    });

    if github.is_none() {
        None
    } else {
        Some(RalphyIntegrationsSummary { github })
    }
}

#[derive(Debug, Serialize)]
pub struct RalphyLabelsSummary {
    pub candidate: Option<String>,
    pub ready: Option<String>,
    pub enriched: Option<String>,
    pub pr_feedback: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct RalphyClaudeSummary {
    pub max_iterations: Option<i64>,
    pub timeout: Option<i64>,
    pub model: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct RalphyGithubIntegrationSummary {
    pub owner: Option<String>,
    pub repo: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct RalphyIntegrationsSummary {
    pub github: Option<RalphyGithubIntegrationSummary>,
}

#[derive(Debug, Serialize)]
pub struct RalphyConfigSummary {
    pub version: Option<i64>,
    pub provider_type: Option<String>,
    pub project_name: Option<String>,
    pub project_key: Option<String>,
    pub project_id: Option<String>,
    pub team_id: Option<String>,
    pub labels: Option<RalphyLabelsSummary>,
    pub claude: Option<RalphyClaudeSummary>,
    pub integrations: Option<RalphyIntegrationsSummary>,
}

#[derive(Debug, Serialize)]
#[serde(tag = "status", rename_all = "lowercase")]
pub enum RalphyConfigResponse {
    Missing { path: String },
    Invalid { path: String, error: String },
    Ok { path: String, summary: Box<RalphyConfigSummary> },
}

#[tauri::command]
pub async fn check_branch_status(path: String, branch: String) -> Result<BranchStatus, String> {
    let repo_path = PathBuf::from(&path);
    let (merged, diverged) = git::get_branch_status(&repo_path, &branch)?;
    Ok(BranchStatus { merged, diverged })
}

#[tauri::command]
pub async fn list_git_changes(path: String) -> Result<Vec<GitChangeEntry>, String> {
    let repo_path = PathBuf::from(&path);
    if !git::is_git_repo(&repo_path) {
        return Err("Path is not a git repository".to_string());
    }
    let changes = git::list_changes(&repo_path)?;

    Ok(changes
        .into_iter()
        .map(|change| GitChangeEntry {
            path: change.path,
            old_path: change.old_path,
            status: change.status.to_string(),
            staged: change.staged,
            unstaged: change.unstaged,
            untracked: change.untracked,
        })
        .collect())
}

#[tauri::command]
pub async fn get_git_diff(
    path: String,
    file_path: String,
    mode: String,
) -> Result<GitDiffResponse, String> {
    let repo_path = PathBuf::from(&path);
    if !git::is_git_repo(&repo_path) {
        return Err("Path is not a git repository".to_string());
    }
    let file_path = PathBuf::from(&file_path);
    let diff_mode = match mode.as_str() {
        "staged" => git::DiffMode::Staged,
        _ => git::DiffMode::Working,
    };
    let diff = git::get_diff(&repo_path, &file_path, diff_mode)?;

    Ok(GitDiffResponse {
        diff: diff.diff,
        is_binary: diff.is_binary,
    })
}

#[tauri::command]
pub async fn get_divergence_base_path() -> Result<String, String> {
    Ok(path_to_string(&get_divergence_dir()))
}

#[tauri::command]
pub async fn kill_tmux_session(session_name: String) -> Result<(), String> {
    git::kill_tmux_session(&session_name)
}

#[derive(Debug, Serialize)]
pub struct TmuxSessionEntry {
    pub name: String,
    pub created: String,
    pub attached: bool,
    pub window_count: u32,
    pub activity: String,
}

#[derive(Debug, Serialize)]
pub struct RawTmuxSessionEntry {
    pub name: String,
    pub socket_path: String,
    pub created: String,
    pub attached: bool,
    pub window_count: u32,
    pub activity: String,
}

#[derive(Debug, Serialize)]
pub struct TmuxCommandDiagnosticsEntry {
    pub status_code: Option<i32>,
    pub stdout: String,
    pub stderr: String,
    pub error: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct TmuxDiagnosticsEntry {
    pub resolved_tmux_path: Option<String>,
    pub login_shell_path: Option<String>,
    pub login_shell_tmux_path: Option<String>,
    pub env_path: Option<String>,
    pub env_shell: Option<String>,
    pub env_tmux: Option<String>,
    pub env_tmux_tmpdir: Option<String>,
    pub login_shell_tmux_tmpdir: Option<String>,
    pub env_tmpdir: Option<String>,
    pub login_shell_tmpdir: Option<String>,
    pub version: TmuxCommandDiagnosticsEntry,
    pub list_sessions_raw: TmuxCommandDiagnosticsEntry,
}

#[tauri::command]
pub async fn list_tmux_sessions() -> Result<Vec<TmuxSessionEntry>, String> {
    let sessions = git::list_tmux_sessions()?;
    Ok(sessions
        .into_iter()
        .map(|s| TmuxSessionEntry {
            name: s.name,
            created: s.created,
            attached: s.attached,
            window_count: s.window_count,
            activity: s.activity,
        })
        .collect())
}

#[tauri::command]
pub async fn list_all_tmux_sessions() -> Result<Vec<RawTmuxSessionEntry>, String> {
    let sessions = git::list_all_tmux_sessions()?;
    Ok(sessions
        .into_iter()
        .map(|s| RawTmuxSessionEntry {
            name: s.name,
            socket_path: s.socket_path,
            created: s.created,
            attached: s.attached,
            window_count: s.window_count,
            activity: s.activity,
        })
        .collect())
}

#[tauri::command]
pub async fn get_tmux_diagnostics() -> Result<TmuxDiagnosticsEntry, String> {
    let diagnostics = git::get_tmux_diagnostics();
    Ok(TmuxDiagnosticsEntry {
        resolved_tmux_path: diagnostics.resolved_tmux_path,
        login_shell_path: diagnostics.login_shell_path,
        login_shell_tmux_path: diagnostics.login_shell_tmux_path,
        env_path: diagnostics.env_path,
        env_shell: diagnostics.env_shell,
        env_tmux: diagnostics.env_tmux,
        env_tmux_tmpdir: diagnostics.env_tmux_tmpdir,
        login_shell_tmux_tmpdir: diagnostics.login_shell_tmux_tmpdir,
        env_tmpdir: diagnostics.env_tmpdir,
        login_shell_tmpdir: diagnostics.login_shell_tmpdir,
        version: TmuxCommandDiagnosticsEntry {
            status_code: diagnostics.version.status_code,
            stdout: diagnostics.version.stdout,
            stderr: diagnostics.version.stderr,
            error: diagnostics.version.error,
        },
        list_sessions_raw: TmuxCommandDiagnosticsEntry {
            status_code: diagnostics.list_sessions_raw.status_code,
            stdout: diagnostics.list_sessions_raw.stdout,
            stderr: diagnostics.list_sessions_raw.stderr,
            error: diagnostics.list_sessions_raw.error,
        },
    })
}

#[tauri::command]
pub async fn kill_all_tmux_sessions(session_names: Vec<String>) -> Result<u32, String> {
    let mut killed = 0u32;
    for name in &session_names {
        git::kill_tmux_session(name)?;
        killed += 1;
    }
    Ok(killed)
}

#[derive(Debug, Serialize)]
pub struct FileListResult {
    pub files: Vec<String>,
    pub truncated: bool,
}

#[tauri::command]
pub async fn list_project_files(root_path: String) -> Result<FileListResult, String> {
    const MAX_FILES: usize = 10_000;

    let ignore_dirs: HashSet<&str> = [
        "node_modules",
        ".git",
        "target",
        "dist",
        "build",
        ".next",
        "__pycache__",
        ".DS_Store",
        ".cache",
        ".turbo",
        ".vercel",
        ".output",
        "coverage",
        ".nyc_output",
        ".parcel-cache",
        ".svelte-kit",
        ".nuxt",
        ".expo",
        "vendor",
    ]
    .into_iter()
    .collect();

    let root = PathBuf::from(&root_path);
    if !root.is_dir() {
        return Err(format!("Path is not a directory: {}", root_path));
    }

    let mut files: Vec<String> = Vec::new();
    let mut truncated = false;
    let mut stack: Vec<PathBuf> = vec![root.clone()];

    while let Some(dir) = stack.pop() {
        let entries = match fs::read_dir(&dir) {
            Ok(entries) => entries,
            Err(_) => continue,
        };

        for entry in entries {
            let entry = match entry {
                Ok(e) => e,
                Err(_) => continue,
            };

            let file_name = entry.file_name();
            let name_str = file_name.to_string_lossy();

            if ignore_dirs.contains(name_str.as_ref()) {
                continue;
            }

            let path = entry.path();
            let file_type = match entry.file_type() {
                Ok(ft) => ft,
                Err(_) => continue,
            };

            if file_type.is_dir() {
                stack.push(path);
            } else if file_type.is_file() {
                if files.len() >= MAX_FILES {
                    truncated = true;
                    break;
                }
                if let Ok(relative) = path.strip_prefix(&root) {
                    files.push(path_to_string(relative));
                }
            }
        }

        if truncated {
            break;
        }
    }

    files.sort();

    Ok(FileListResult { files, truncated })
}

#[tauri::command]
pub async fn list_branch_changes(path: String) -> Result<BranchChangesResponse, String> {
    let repo_path = PathBuf::from(&path);
    if !git::is_git_repo(&repo_path) {
        return Err("Path is not a git repository".to_string());
    }
    let result = git::list_branch_changes(&repo_path)?;

    Ok(BranchChangesResponse {
        base_ref: result.base_ref,
        changes: result
            .changes
            .into_iter()
            .map(|change| GitChangeEntry {
                path: change.path,
                old_path: change.old_path,
                status: change.status.to_string(),
                staged: change.staged,
                unstaged: change.unstaged,
                untracked: change.untracked,
            })
            .collect(),
    })
}

#[tauri::command]
pub async fn get_branch_diff(
    path: String,
    file_path: String,
) -> Result<GitDiffResponse, String> {
    let repo_path = PathBuf::from(&path);
    if !git::is_git_repo(&repo_path) {
        return Err("Path is not a git repository".to_string());
    }
    let file_path = PathBuf::from(&file_path);
    let diff = git::get_branch_diff(&repo_path, &file_path)?;

    Ok(GitDiffResponse {
        diff: diff.diff,
        is_binary: diff.is_binary,
    })
}

#[derive(Debug, Serialize)]
pub struct TmuxPaneStatusEntry {
    pub alive: bool,
    pub exit_code: Option<i32>,
}

#[tauri::command]
pub async fn spawn_tmux_automation_session(
    session_name: String,
    command: String,
    cwd: String,
    log_path: String,
    env_vars: Vec<(String, String)>,
) -> Result<(), String> {
    git::spawn_tmux_automation_session(&session_name, &command, &cwd, &log_path, &env_vars)
}

#[tauri::command]
pub async fn query_tmux_pane_status(
    session_name: String,
) -> Result<TmuxPaneStatusEntry, String> {
    let status = git::query_tmux_pane_status(&session_name)?;
    Ok(TmuxPaneStatusEntry {
        alive: status.alive,
        exit_code: status.exit_code,
    })
}

#[tauri::command]
pub async fn read_file_tail(
    path: String,
    max_bytes: u64,
) -> Result<Option<String>, String> {
    git::read_file_tail(&path, max_bytes)
}

#[tauri::command]
pub async fn read_file_if_exists(
    path: String,
) -> Result<Option<String>, String> {
    git::read_file_if_exists(&path)
}

#[tauri::command]
pub async fn write_review_brief_file(
    workspace_path: String,
    markdown: String,
) -> Result<WriteReviewBriefResponse, String> {
    let workspace = PathBuf::from(&workspace_path);
    if !workspace.is_dir() {
        return Err(format!("Workspace path is not a directory: {}", workspace_path));
    }

    let review_dir = workspace.join(".divergence");
    fs::create_dir_all(&review_dir)
        .map_err(|error| format!("Failed to create review directory: {}", error))?;

    let short_id = &Uuid::new_v4().to_string()[..8];
    let timestamp = chrono::Utc::now().format("%Y%m%d-%H%M%S");
    let file_name = format!("review-brief-{}-{}.md", timestamp, short_id);
    let file_path = review_dir.join(file_name);

    fs::write(&file_path, markdown)
        .map_err(|error| format!("Failed to write review brief: {}", error))?;

    Ok(WriteReviewBriefResponse {
        path: path_to_string(&file_path),
    })
}

// ── Workspace commands ──────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceProjectInput {
    pub name: String,
    pub path: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceFolderResult {
    pub folder_path: String,
    pub claude_md_path: String,
    pub agents_md_path: String,
}

fn generate_workspace_claude_md(name: &str, projects: &[WorkspaceProjectInput]) -> String {
    let mut md = format!("# Workspace: {}\n\n", name);
    md.push_str("This is an AI workspace that groups multiple projects together.\n");
    md.push_str("Each project is accessible via a symlink in this directory.\n\n");
    md.push_str("## Projects\n\n");

    for project in projects {
        let link_name = project.name.replace(' ', "-").to_lowercase();
        md.push_str(&format!(
            "- **{}** (`./{}`) — `{}`\n",
            project.name, link_name, project.path
        ));
    }

    md.push_str("\n## Cross-Project Notes\n\n");
    md.push_str("- All projects are symlinked in this directory for unified access.\n");
    md.push_str("- Changes made via symlinks affect the original project files.\n");
    md.push_str("- Use relative paths from this workspace root to reference files across projects.\n");
    md
}

fn generate_workspace_agents_md(name: &str, projects: &[WorkspaceProjectInput]) -> String {
    let mut md = format!("# Workspace: {}\n\n", name);
    md.push_str("## Project Directory\n\n");
    md.push_str("| Project | Symlink | Path |\n");
    md.push_str("|---------|---------|------|\n");

    for project in projects {
        let link_name = project.name.replace(' ', "-").to_lowercase();
        md.push_str(&format!(
            "| {} | `./{}` | `{}` |\n",
            project.name, link_name, project.path
        ));
    }

    md.push_str("\n## Usage\n\n");
    md.push_str("This workspace provides unified access to all member projects.\n");
    md.push_str("Navigate into any symlinked directory to work with that project.\n");
    md
}

#[tauri::command]
pub async fn create_workspace_folder(
    slug: String,
    workspace_name: String,
    projects: Vec<WorkspaceProjectInput>,
) -> Result<WorkspaceFolderResult, String> {
    let workspaces_dir = get_workspaces_dir();
    let folder_path = workspaces_dir.join(&slug);

    fs::create_dir_all(&folder_path)
        .map_err(|e| format!("Failed to create workspace folder: {}", e))?;

    // Create symlinks for each project
    for project in &projects {
        let link_name = project.name.replace(' ', "-").to_lowercase();
        let link_path = folder_path.join(&link_name);
        let target_path = PathBuf::from(&project.path);

        // Remove existing symlink if present
        if link_path.exists() || link_path.symlink_metadata().is_ok() {
            let _ = fs::remove_file(&link_path);
        }

        #[cfg(unix)]
        std::os::unix::fs::symlink(&target_path, &link_path)
            .map_err(|e| format!("Failed to create symlink for {}: {}", project.name, e))?;

        #[cfg(not(unix))]
        return Err("Symlinks are only supported on Unix systems".to_string());
    }

    // Generate CLAUDE.md
    let claude_md_content = generate_workspace_claude_md(&workspace_name, &projects);
    let claude_md_path = folder_path.join("CLAUDE.md");
    fs::write(&claude_md_path, &claude_md_content)
        .map_err(|e| format!("Failed to write CLAUDE.md: {}", e))?;

    // Generate agents.md
    let agents_md_content = generate_workspace_agents_md(&workspace_name, &projects);
    let agents_md_path = folder_path.join("agents.md");
    fs::write(&agents_md_path, &agents_md_content)
        .map_err(|e| format!("Failed to write agents.md: {}", e))?;

    // Generate .claude/settings.json
    let claude_dir = folder_path.join(".claude");
    fs::create_dir_all(&claude_dir)
        .map_err(|e| format!("Failed to create .claude directory: {}", e))?;

    let additional_dirs: Vec<String> = projects.iter().map(|p| p.path.clone()).collect();
    let settings = serde_json::json!({
        "additionalDirectories": additional_dirs,
    });
    let settings_path = claude_dir.join("settings.json");
    fs::write(&settings_path, serde_json::to_string_pretty(&settings).unwrap_or_default())
        .map_err(|e| format!("Failed to write .claude/settings.json: {}", e))?;

    Ok(WorkspaceFolderResult {
        folder_path: path_to_string(&folder_path),
        claude_md_path: path_to_string(&claude_md_path),
        agents_md_path: path_to_string(&agents_md_path),
    })
}

#[tauri::command]
pub async fn update_workspace_folder(
    folder_path: String,
    workspace_name: String,
    projects: Vec<WorkspaceProjectInput>,
) -> Result<WorkspaceFolderResult, String> {
    let folder = PathBuf::from(&folder_path);
    if !folder.is_dir() {
        return Err(format!("Workspace folder does not exist: {}", folder_path));
    }

    // Remove old symlinks (only symlinks, not regular files/dirs)
    if let Ok(entries) = fs::read_dir(&folder) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.symlink_metadata().map(|m| m.file_type().is_symlink()).unwrap_or(false) {
                let _ = fs::remove_file(&path);
            }
        }
    }

    // Recreate symlinks
    for project in &projects {
        let link_name = project.name.replace(' ', "-").to_lowercase();
        let link_path = folder.join(&link_name);
        let target_path = PathBuf::from(&project.path);

        #[cfg(unix)]
        std::os::unix::fs::symlink(&target_path, &link_path)
            .map_err(|e| format!("Failed to create symlink for {}: {}", project.name, e))?;

        #[cfg(not(unix))]
        return Err("Symlinks are only supported on Unix systems".to_string());
    }

    // Regenerate CLAUDE.md
    let claude_md_content = generate_workspace_claude_md(&workspace_name, &projects);
    let claude_md_path = folder.join("CLAUDE.md");
    fs::write(&claude_md_path, &claude_md_content)
        .map_err(|e| format!("Failed to write CLAUDE.md: {}", e))?;

    // Regenerate agents.md
    let agents_md_content = generate_workspace_agents_md(&workspace_name, &projects);
    let agents_md_path = folder.join("agents.md");
    fs::write(&agents_md_path, &agents_md_content)
        .map_err(|e| format!("Failed to write agents.md: {}", e))?;

    // Regenerate .claude/settings.json
    let claude_dir = folder.join(".claude");
    fs::create_dir_all(&claude_dir)
        .map_err(|e| format!("Failed to create .claude directory: {}", e))?;

    let additional_dirs: Vec<String> = projects.iter().map(|p| p.path.clone()).collect();
    let settings = serde_json::json!({
        "additionalDirectories": additional_dirs,
    });
    let settings_path = claude_dir.join("settings.json");
    fs::write(&settings_path, serde_json::to_string_pretty(&settings).unwrap_or_default())
        .map_err(|e| format!("Failed to write .claude/settings.json: {}", e))?;

    Ok(WorkspaceFolderResult {
        folder_path: path_to_string(&folder),
        claude_md_path: path_to_string(&claude_md_path),
        agents_md_path: path_to_string(&agents_md_path),
    })
}

#[tauri::command]
pub async fn delete_workspace_folder(folder_path: String) -> Result<(), String> {
    let folder = PathBuf::from(&folder_path);

    // Safety check: path must be within the workspaces directory
    let workspaces_dir = get_workspaces_dir();
    if !folder.starts_with(&workspaces_dir) {
        return Err("Cannot delete path outside of workspaces directory".to_string());
    }

    if folder.exists() {
        let delete_path = folder.clone();
        tauri::async_runtime::spawn_blocking(move || fs::remove_dir_all(&delete_path))
            .await
            .map_err(|e| format!("Failed to delete workspace folder: {}", e))?
            .map_err(|e| format!("Failed to delete workspace folder: {}", e))?;
    }

    Ok(())
}

#[tauri::command]
pub async fn get_workspaces_base_path() -> Result<String, String> {
    Ok(path_to_string(&get_workspaces_dir()))
}

#[tauri::command]
pub async fn check_port_available(port: u16) -> Result<bool, String> {
    match std::net::TcpListener::bind(("127.0.0.1", port)) {
        Ok(_) => Ok(true),
        Err(_) => Ok(false),
    }
}
