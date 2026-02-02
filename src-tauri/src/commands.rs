use crate::db::{get_divergence_dir, get_repos_dir};
use crate::git;
use serde::{Deserialize, Serialize};
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

    // Checkout or create branch
    git::checkout_branch(&divergence_path, &branch_name, true)?;

    // Copy ignored files (e.g., .env) from source into the divergence clone
    git::copy_ignored_paths(&source_path, &divergence_path, &copy_ignored_skip)?;

    Ok(Divergence {
        id: 0, // Will be set by database
        project_id,
        name: divergence_dir_name,
        branch: branch_name,
        path: divergence_path.to_string_lossy().to_string(),
        created_at: chrono::Utc::now().to_rfc3339(),
    })
}

#[tauri::command]
pub async fn list_divergences(_project_id: i64) -> Result<Vec<Divergence>, String> {
    // Database query handled by frontend
    Ok(vec![])
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
pub async fn check_branch_merged(path: String, branch: String) -> Result<bool, String> {
    let repo_path = PathBuf::from(&path);
    git::is_branch_merged(&repo_path, &branch)
}

#[tauri::command]
pub async fn get_divergence_base_path() -> Result<String, String> {
    Ok(get_divergence_dir().to_string_lossy().to_string())
}

#[tauri::command]
pub async fn kill_tmux_session(session_name: String) -> Result<(), String> {
    git::kill_tmux_session(&session_name)
}
