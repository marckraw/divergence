use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::io::ErrorKind;

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

pub fn copy_ignored_paths(
    source: &Path,
    destination: &Path,
    skip_list: &[String],
) -> Result<(), String> {
    let ignored = list_ignored_paths(source)?;

    for relative_path in ignored {
        if should_skip_path(&relative_path, skip_list) {
            continue;
        }
        let src_path = source.join(&relative_path);
        let dest_path = destination.join(&relative_path);

        if src_path.is_dir() {
            copy_dir_all(&src_path, &dest_path)?;
        } else if src_path.is_file() {
            if let Some(parent) = dest_path.parent() {
                fs::create_dir_all(parent)
                    .map_err(|e| format!("Failed to create directory {:?}: {}", parent, e))?;
            }
            fs::copy(&src_path, &dest_path)
                .map_err(|e| format!("Failed to copy file {:?}: {}", src_path, e))?;
        }
    }

    Ok(())
}

pub fn set_origin_to_source_remote(source: &Path, destination: &Path) -> Result<(), String> {
    let Some(remote_url) = get_remote_url(source)? else {
        return Ok(());
    };

    let set_output = Command::new("git")
        .args(["remote", "set-url", "origin", &remote_url])
        .current_dir(destination)
        .output()
        .map_err(|e| format!("Failed to set origin URL: {}", e))?;

    if set_output.status.success() {
        return Ok(());
    }

    let add_output = Command::new("git")
        .args(["remote", "add", "origin", &remote_url])
        .current_dir(destination)
        .output()
        .map_err(|e| format!("Failed to add origin URL: {}", e))?;

    if !add_output.status.success() {
        return Err(format!(
            "Failed to set origin URL: {}",
            String::from_utf8_lossy(&add_output.stderr)
        ));
    }

    Ok(())
}

pub fn kill_tmux_session(session_name: &str) -> Result<(), String> {
    let output = Command::new("tmux")
        .args(["kill-session", "-t", session_name])
        .output();

    match output {
        Ok(result) => {
            if result.status.success() {
                return Ok(());
            }

            let stderr = String::from_utf8_lossy(&result.stderr);
            if stderr.contains("can't find session")
                || stderr.contains("no server running")
                || stderr.contains("failed to connect to server")
            {
                return Ok(());
            }

            Err(format!("Failed to kill tmux session: {}", stderr))
        }
        Err(err) => {
            if err.kind() == ErrorKind::NotFound {
                return Ok(());
            }
            Err(format!("Failed to execute tmux: {}", err))
        }
    }
}

fn list_ignored_paths(repo_path: &Path) -> Result<Vec<PathBuf>, String> {
    let output = Command::new("git")
        .args(["ls-files", "--others", "-i", "--exclude-standard", "-z"])
        .current_dir(repo_path)
        .output()
        .map_err(|e| format!("Failed to list ignored files: {}", e))?;

    if !output.status.success() {
        return Err(format!(
            "Failed to list ignored files: {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }

    let mut paths = Vec::new();
    for part in output.stdout.split(|b| *b == 0u8) {
        if part.is_empty() {
            continue;
        }
        let path = PathBuf::from(String::from_utf8_lossy(part).to_string());
        paths.push(path);
    }

    Ok(paths)
}

fn should_skip_path(path: &Path, skip_list: &[String]) -> bool {
    if skip_list.is_empty() {
        return false;
    }

    let path_str = path.to_string_lossy().replace('\\', "/");
    let components: Vec<&str> = path_str.split('/').collect();

    for entry in skip_list {
        let trimmed = entry.trim();
        if trimmed.is_empty() {
            continue;
        }

        let normalized = trimmed.replace('\\', "/");

        if normalized.contains('/') {
            if path_str == normalized || path_str.starts_with(&format!("{}/", normalized)) {
                return true;
            }
        } else if components.iter().any(|component| *component == normalized) {
            return true;
        }
    }

    false
}

fn copy_dir_all(source: &Path, destination: &Path) -> Result<(), String> {
    fs::create_dir_all(destination)
        .map_err(|e| format!("Failed to create directory {:?}: {}", destination, e))?;

    for entry in fs::read_dir(source)
        .map_err(|e| format!("Failed to read directory {:?}: {}", source, e))?
    {
        let entry = entry.map_err(|e| format!("Failed to read directory entry: {}", e))?;
        let file_type = entry
            .file_type()
            .map_err(|e| format!("Failed to read file type: {}", e))?;

        let src_path = entry.path();
        let dest_path = destination.join(entry.file_name());

        if file_type.is_dir() {
            copy_dir_all(&src_path, &dest_path)?;
        } else if file_type.is_file() {
            fs::copy(&src_path, &dest_path)
                .map_err(|e| format!("Failed to copy file {:?}: {}", src_path, e))?;
        }
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
