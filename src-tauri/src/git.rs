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

pub fn checkout_existing_branch(repo_path: &Path, branch: &str) -> Result<(), String> {
    fetch_origin(repo_path);

    let local_ref = format!("refs/heads/{}", branch);
    if ref_exists(repo_path, &local_ref)? {
        return checkout_branch(repo_path, branch, false);
    }

    let remote_ref = format!("refs/remotes/origin/{}", branch);
    if !ref_exists(repo_path, &remote_ref)? {
        return Err(format!("Remote branch origin/{} not found", branch));
    }

    let output = Command::new("git")
        .args(["checkout", "-b", branch, &format!("origin/{}", branch)])
        .current_dir(repo_path)
        .output()
        .map_err(|e| format!("Failed to execute git checkout: {}", e))?;

    if !output.status.success() {
        return Err(format!(
            "Git checkout failed: {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }

    Ok(())
}

pub fn list_remote_branches(repo_path: &Path) -> Result<Vec<String>, String> {
    if get_remote_url(repo_path)?.is_none() {
        return Err("Remote origin is not configured for this repository".to_string());
    }

    fetch_origin(repo_path);

    let output = Command::new("git")
        .args([
            "for-each-ref",
            "--format=%(refname:short)",
            "refs/remotes/origin",
        ])
        .current_dir(repo_path)
        .output()
        .map_err(|e| format!("Failed to list remote branches: {}", e))?;

    if !output.status.success() {
        return Err(format!(
            "Failed to list remote branches: {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }

    let mut branches = Vec::new();
    for line in String::from_utf8_lossy(&output.stdout).lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed == "origin/HEAD" {
            continue;
        }
        let name = trimmed.strip_prefix("origin/").unwrap_or(trimmed);
        branches.push(name.to_string());
    }

    branches.sort();
    branches.dedup();

    Ok(branches)
}

#[allow(dead_code)]
pub fn is_branch_merged(repo_path: &Path, branch: &str) -> Result<bool, String> {
    // First, fetch to ensure we have latest remote state
    fetch_origin(repo_path);

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

pub fn get_branch_status(repo_path: &Path, branch: &str) -> Result<(bool, bool), String> {
    // Fetch latest remote state (best effort)
    fetch_origin(repo_path);

    let Some(base_ref) = find_base_ref(repo_path)? else {
        return Ok((false, false));
    };

    let diverged = branch_ahead_count(repo_path, &base_ref, branch)? > 0;
    let merged = merge_base_is_ancestor(repo_path, branch, &base_ref)?;

    Ok((merged, diverged))
}

fn find_base_ref(repo_path: &Path) -> Result<Option<String>, String> {
    if let Some(default_remote) = get_default_remote_branch(repo_path)? {
        return Ok(Some(default_remote));
    }

    let remote_candidates = [
        ("origin/main", "refs/remotes/origin/main"),
        ("origin/master", "refs/remotes/origin/master"),
        ("origin/develop", "refs/remotes/origin/develop"),
    ];

    for (name, reference) in remote_candidates {
        if ref_exists(repo_path, reference)? {
            return Ok(Some(name.to_string()));
        }
    }

    let local_candidates = [
        ("main", "refs/heads/main"),
        ("master", "refs/heads/master"),
        ("develop", "refs/heads/develop"),
    ];

    for (name, reference) in local_candidates {
        if ref_exists(repo_path, reference)? {
            return Ok(Some(name.to_string()));
        }
    }

    Ok(None)
}

fn get_default_remote_branch(repo_path: &Path) -> Result<Option<String>, String> {
    let output = Command::new("git")
        .args(["symbolic-ref", "--quiet", "--short", "refs/remotes/origin/HEAD"])
        .current_dir(repo_path)
        .output()
        .map_err(|e| format!("Failed to execute git symbolic-ref: {}", e))?;

    if output.status.success() {
        let branch = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if !branch.is_empty() {
            return Ok(Some(branch));
        }
    }

    Ok(None)
}

fn fetch_origin(repo_path: &Path) {
    let _ = Command::new("git")
        .args(["fetch", "origin"])
        .current_dir(repo_path)
        .output();
}

fn ref_exists(repo_path: &Path, reference: &str) -> Result<bool, String> {
    let status = Command::new("git")
        .args(["show-ref", "--verify", "--quiet", reference])
        .current_dir(repo_path)
        .status()
        .map_err(|e| format!("Failed to execute git show-ref: {}", e))?;

    Ok(status.success())
}

fn branch_ahead_count(repo_path: &Path, base_ref: &str, branch: &str) -> Result<i64, String> {
    let output = Command::new("git")
        .args(["rev-list", "--count", &format!("{}..{}", base_ref, branch)])
        .current_dir(repo_path)
        .output()
        .map_err(|e| format!("Failed to execute git rev-list: {}", e))?;

    if !output.status.success() {
        return Err(format!(
            "Failed to compute branch ahead count: {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }

    let count_str = String::from_utf8_lossy(&output.stdout);
    let count = count_str.trim().parse::<i64>().unwrap_or(0);
    Ok(count)
}

fn merge_base_is_ancestor(repo_path: &Path, branch: &str, base_ref: &str) -> Result<bool, String> {
    let status = Command::new("git")
        .args(["merge-base", "--is-ancestor", branch, base_ref])
        .current_dir(repo_path)
        .status()
        .map_err(|e| format!("Failed to execute git merge-base: {}", e))?;

    Ok(status.success())
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
