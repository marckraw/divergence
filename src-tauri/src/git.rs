use std::path::Path;
use std::process::Command;

pub fn clone_repo(source: &Path, destination: &Path) -> Result<(), String> {
    let output = Command::new("git")
        .args(["clone", "--local"])
        .arg(source)
        .arg(destination)
        .output()
        .map_err(|e| format!("Failed to execute git clone: {}", e))?;

    if !output.status.success() {
        return Err(format!(
            "Git clone failed: {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }

    Ok(())
}

pub fn checkout_branch(repo_path: &Path, branch: &str, create: bool) -> Result<(), String> {
    let mut args = vec!["checkout"];
    if create {
        args.push("-b");
    }
    args.push(branch);

    let output = Command::new("git")
        .args(&args)
        .current_dir(repo_path)
        .output()
        .map_err(|e| format!("Failed to execute git checkout: {}", e))?;

    if !output.status.success() {
        // If creating failed, try checking out existing branch
        if create {
            return checkout_branch(repo_path, branch, false);
        }
        return Err(format!(
            "Git checkout failed: {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }

    Ok(())
}

pub fn is_branch_merged(repo_path: &Path, branch: &str) -> Result<bool, String> {
    // First, fetch to ensure we have latest remote state
    let _ = Command::new("git")
        .args(["fetch", "origin"])
        .current_dir(repo_path)
        .output();

    // Check if branch is merged into main or master
    for main_branch in &["main", "master"] {
        let output = Command::new("git")
            .args(["branch", "--merged", main_branch])
            .current_dir(repo_path)
            .output()
            .map_err(|e| format!("Failed to check merged branches: {}", e))?;

        if output.status.success() {
            let merged = String::from_utf8_lossy(&output.stdout);
            let branches: Vec<&str> = merged.lines().map(|l| l.trim().trim_start_matches("* ")).collect();
            if branches.contains(&branch) {
                return Ok(true);
            }
        }
    }

    Ok(false)
}

pub fn get_remote_url(repo_path: &Path) -> Result<Option<String>, String> {
    let output = Command::new("git")
        .args(["remote", "get-url", "origin"])
        .current_dir(repo_path)
        .output()
        .map_err(|e| format!("Failed to get remote URL: {}", e))?;

    if output.status.success() {
        Ok(Some(String::from_utf8_lossy(&output.stdout).trim().to_string()))
    } else {
        Ok(None)
    }
}

pub fn is_git_repo(path: &Path) -> bool {
    path.join(".git").exists()
}
