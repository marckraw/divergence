use crate::db::{get_divergence_dir, get_repos_dir};
use crate::git;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::fs;
use std::path::PathBuf;
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize)]
pub struct Project {
    pub id: i64,
    pub name: String,
    pub path: String,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Divergence {
    pub id: i64,
    pub project_id: i64,
    pub name: String,
    pub branch: String,
    pub path: String,
    pub created_at: String,
    pub has_diverged: i32,
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
    let safe_branch_name = branch_name.replace('/', "-").replace(' ', "-");
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
        path: divergence_path.to_string_lossy().to_string(),
        created_at: chrono::Utc::now().to_rfc3339(),
        has_diverged: 0,
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
        fs::remove_dir_all(&divergence_path)
            .map_err(|e| format!("Failed to delete divergence directory: {}", e))?;
    }

    Ok(())
}

#[tauri::command]
pub async fn get_ralphy_config_summary(project_path: String) -> Result<RalphyConfigResponse, String> {
    let config_path = PathBuf::from(&project_path)
        .join(".ralphy")
        .join("config.json");
    let path_string = config_path.to_string_lossy().to_string();

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
        summary,
    })
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BranchStatus {
    pub merged: bool,
    pub diverged: bool,
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
    Ok { path: String, summary: RalphyConfigSummary },
}

#[tauri::command]
pub async fn check_branch_status(path: String, branch: String) -> Result<BranchStatus, String> {
    let repo_path = PathBuf::from(&path);
    let (merged, diverged) = git::get_branch_status(&repo_path, &branch)?;
    Ok(BranchStatus { merged, diverged })
}

#[tauri::command]
pub async fn get_divergence_base_path() -> Result<String, String> {
    Ok(get_divergence_dir().to_string_lossy().to_string())
}

#[tauri::command]
pub async fn kill_tmux_session(session_name: String) -> Result<(), String> {
    git::kill_tmux_session(&session_name)
}
