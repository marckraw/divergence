use std::fs;
use std::path::PathBuf;
use tauri::AppHandle;

pub fn get_divergence_dir() -> PathBuf {
    let home = dirs::home_dir()
        .or_else(|| std::env::current_dir().ok())
        .unwrap_or_else(|| PathBuf::from("."));
    home.join(".divergence")
}

pub fn get_repos_dir() -> PathBuf {
    get_divergence_dir().join("repos")
}

pub fn get_workspaces_dir() -> PathBuf {
    get_divergence_dir().join("workspaces")
}

#[allow(dead_code)]
pub fn get_database_path() -> PathBuf {
    get_divergence_dir().join("divergence.db")
}

pub async fn init_database(_app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    // Ensure directories exist
    let divergence_dir = get_divergence_dir();
    let repos_dir = get_repos_dir();
    let workspaces_dir = get_workspaces_dir();

    fs::create_dir_all(&divergence_dir)?;
    fs::create_dir_all(&repos_dir)?;
    fs::create_dir_all(&workspaces_dir)?;

    // Database will be initialized via tauri-plugin-sql
    // Schema is created in the frontend on first connection

    Ok(())
}
