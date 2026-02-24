use std::fs;
use std::io::Write as IoWrite;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::{Mutex, OnceLock};
use std::io::ErrorKind;
use chrono::{DateTime, Utc};

static DEBUG_LOG: OnceLock<Mutex<Option<fs::File>>> = OnceLock::new();

fn debug_log(msg: &str) {
    eprintln!("{}", msg);
    let mutex = DEBUG_LOG.get_or_init(|| {
        let log_dir = dirs::home_dir()
            .map(|h| {
                if cfg!(target_os = "macos") {
                    h.join("Library/Logs/Divergence")
                } else {
                    h.join(".local/share/divergence/logs")
                }
            })
            .unwrap_or_else(|| PathBuf::from("/tmp"));
        let _ = fs::create_dir_all(&log_dir);
        let log_path = log_dir.join("tmux-debug.log");
        let file = fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(&log_path)
            .ok();
        Mutex::new(file)
    });
    if let Ok(mut guard) = mutex.lock() {
        if let Some(ref mut file) = *guard {
            let now = chrono::Local::now().format("%Y-%m-%d %H:%M:%S%.3f");
            let _ = writeln!(file, "[{}] {}", now, msg);
        }
    }
}

#[derive(Debug, Clone)]
pub struct GitChange {
    pub path: String,
    pub old_path: Option<String>,
    pub status: char,
    pub staged: bool,
    pub unstaged: bool,
    pub untracked: bool,
}

#[derive(Debug, Clone)]
pub struct GitDiff {
    pub diff: String,
    pub is_binary: bool,
}

#[derive(Debug, Clone)]
pub struct BranchChanges {
    pub base_ref: Option<String>,
    pub changes: Vec<GitChange>,
}

#[derive(Debug, Clone, Copy)]
pub enum DiffMode {
    Working,
    Staged,
}

fn path_to_string(path: &Path) -> String {
    path.to_string_lossy().into_owned()
}

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
    if !session_name.starts_with("divergence-") {
        return Ok(());
    }

    let output = command_with_tmux()
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

#[derive(Debug, Clone)]
pub struct TmuxSessionInfo {
    pub name: String,
    pub created: String,
    pub attached: bool,
    pub window_count: u32,
    pub activity: String,
}

#[derive(Debug, Clone)]
pub struct RawTmuxSessionInfo {
    pub name: String,
    pub socket_path: String,
    pub created: String,
    pub attached: bool,
    pub window_count: u32,
    pub activity: String,
}

#[derive(Debug, Clone)]
pub struct TmuxCommandDiagnostics {
    pub status_code: Option<i32>,
    pub stdout: String,
    pub stderr: String,
    pub error: Option<String>,
}

#[derive(Debug, Clone)]
pub struct TmuxDiagnostics {
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
    pub version: TmuxCommandDiagnostics,
    pub list_sessions_raw: TmuxCommandDiagnostics,
}

fn epoch_to_iso8601(epoch: &str) -> String {
    epoch
        .trim()
        .parse::<i64>()
        .ok()
        .and_then(|secs| DateTime::from_timestamp(secs, 0))
        .map(|dt: DateTime<Utc>| dt.to_rfc3339())
        .unwrap_or_default()
}

pub fn list_tmux_sessions() -> Result<Vec<TmuxSessionInfo>, String> {
    dump_process_env_once();
    debug_log("[divergence] list_tmux_sessions: starting");
    debug_log(&format!("[divergence] list_tmux_sessions: process TMPDIR={:?}", std::env::var("TMPDIR").ok()));
    debug_log(&format!("[divergence] list_tmux_sessions: process TMUX_TMPDIR={:?}", std::env::var("TMUX_TMPDIR").ok()));

    const SEP: &str = ":::";
    let fmt = format!(
        "#{{session_name}}{0}#{{session_created}}{0}#{{session_attached}}{0}#{{session_windows}}{0}#{{session_activity}}",
        SEP
    );

    let mut cmd = command_with_tmux();
    cmd.args(["list-sessions", "-F", &fmt]);
    let output = cmd.output();

    let result = match output {
        Ok(r) => r,
        Err(err) => {
            debug_log(&format!("[divergence] list_tmux_sessions: tmux command FAILED to execute: {} (kind={:?})", err, err.kind()));
            if err.kind() == ErrorKind::NotFound {
                return Ok(vec![]);
            }
            return Err(format!("Failed to execute tmux: {}", err));
        }
    };

    let stdout = String::from_utf8_lossy(&result.stdout);
    let stderr = String::from_utf8_lossy(&result.stderr);

    debug_log(&format!(
        "[divergence] list_tmux_sessions: exit={:?}, stdout_len={}, stderr_len={}, stderr={:?}",
        result.status.code(),
        stdout.len(),
        stderr.len(),
        stderr.chars().take(300).collect::<String>()
    ));

    // Log hex bytes of first line to diagnose separator issues
    if let Some(first_line) = stdout.lines().next() {
        let hex: String = first_line.bytes().take(120).map(|b| format!("{:02x}", b)).collect::<Vec<_>>().join(" ");
        debug_log(&format!("[divergence] list_tmux_sessions: first line hex (up to 120 bytes): {}", hex));
    }

    if !result.status.success() {
        if stderr.contains("no server running") || stderr.contains("failed to connect to server") {
            debug_log("[divergence] list_tmux_sessions: no tmux server running (this is normal if no sessions exist)");
            return Ok(vec![]);
        }
        return Err(format!("Failed to list tmux sessions: {}", stderr));
    }

    let total_lines = stdout.lines().count();
    let mut sessions = Vec::new();
    let mut skipped_non_divergence = 0u32;

    for line in stdout.lines() {
        let parts: Vec<&str> = line.split(SEP).collect();
        if parts.len() < 5 {
            debug_log(&format!("[divergence] list_tmux_sessions: skipping malformed line (parts={}): {:?}", parts.len(), line.chars().take(100).collect::<String>()));
            continue;
        }
        let name = parts[0];
        if !name.starts_with("divergence-") {
            skipped_non_divergence += 1;
            continue;
        }
        sessions.push(TmuxSessionInfo {
            name: name.to_string(),
            created: epoch_to_iso8601(parts[1]),
            attached: parts[2] != "0",
            window_count: parts[3].trim().parse().unwrap_or(0),
            activity: epoch_to_iso8601(parts[4]),
        });
    }

    debug_log(&format!(
        "[divergence] list_tmux_sessions: total_lines={}, divergence_sessions={}, skipped_non_divergence={}",
        total_lines, sessions.len(), skipped_non_divergence
    ));

    Ok(sessions)
}

pub fn list_all_tmux_sessions() -> Result<Vec<RawTmuxSessionInfo>, String> {
    debug_log("[divergence] list_all_tmux_sessions: starting");
    const SEP: &str = ":::";
    let fmt = format!(
        "#{{session_name}}{0}#{{socket_path}}{0}#{{session_created}}{0}#{{session_attached}}{0}#{{session_windows}}{0}#{{session_activity}}",
        SEP
    );
    let output = command_with_tmux()
        .args(["list-sessions", "-F", &fmt])
        .output();

    let result = match output {
        Ok(r) => r,
        Err(err) => {
            debug_log(&format!("[divergence] list_all_tmux_sessions: tmux command FAILED: {} (kind={:?})", err, err.kind()));
            if err.kind() == ErrorKind::NotFound {
                return Ok(vec![]);
            }
            return Err(format!("Failed to execute tmux: {}", err));
        }
    };

    let stdout = String::from_utf8_lossy(&result.stdout);
    let stderr = String::from_utf8_lossy(&result.stderr);
    debug_log(&format!(
        "[divergence] list_all_tmux_sessions: exit={:?}, stdout_len={}, stderr={:?}",
        result.status.code(), stdout.len(), stderr.chars().take(200).collect::<String>()
    ));

    if !result.status.success() {
        if stderr.contains("no server running") || stderr.contains("failed to connect to server") {
            debug_log("[divergence] list_all_tmux_sessions: no tmux server running");
            return Ok(vec![]);
        }
        return Err(format!("Failed to list tmux sessions: {}", stderr));
    }

    let mut sessions = Vec::new();

    for line in stdout.lines() {
        let parts: Vec<&str> = line.split(SEP).collect();
        if parts.len() < 6 {
            continue;
        }
        debug_log(&format!("[divergence] list_all_tmux_sessions: found session {:?} socket={:?}", parts[0], parts[1]));
        sessions.push(RawTmuxSessionInfo {
            name: parts[0].to_string(),
            socket_path: parts[1].to_string(),
            created: epoch_to_iso8601(parts[2]),
            attached: parts[3] != "0",
            window_count: parts[4].trim().parse().unwrap_or(0),
            activity: epoch_to_iso8601(parts[5]),
        });
    }

    debug_log(&format!("[divergence] list_all_tmux_sessions: returning {} sessions", sessions.len()));
    Ok(sessions)
}

pub fn get_tmux_diagnostics() -> TmuxDiagnostics {
    let login_shell_tmux_context = get_login_shell_tmux_context();

    TmuxDiagnostics {
        resolved_tmux_path: get_tmux_path().map(|path| path_to_string(&path)),
        login_shell_path: get_login_shell_path(),
        login_shell_tmux_path: login_shell_tmux_context
            .tmux_path
            .map(|path| path_to_string(&path)),
        env_path: std::env::var("PATH").ok(),
        env_shell: std::env::var("SHELL").ok(),
        env_tmux: std::env::var("TMUX").ok(),
        env_tmux_tmpdir: std::env::var("TMUX_TMPDIR").ok(),
        login_shell_tmux_tmpdir: login_shell_tmux_context.tmux_tmpdir.clone(),
        env_tmpdir: std::env::var("TMPDIR").ok(),
        login_shell_tmpdir: login_shell_tmux_context.tmpdir.clone(),
        version: run_tmux_command_for_diagnostics(&["-V"]),
        list_sessions_raw: run_tmux_command_for_diagnostics(&[
            "list-sessions",
            "-F",
            "#{session_name}:::#{socket_path}:::#{session_created}:::#{session_attached}:::#{session_windows}:::#{session_activity}",
        ]),
    }
}

static LOGIN_SHELL_PATH: OnceLock<Option<String>> = OnceLock::new();
static TMUX_PATH: OnceLock<Option<PathBuf>> = OnceLock::new();
static LOGIN_SHELL_TMUX_CONTEXT: OnceLock<LoginShellTmuxContext> = OnceLock::new();
static ENV_DUMP_DONE: OnceLock<()> = OnceLock::new();

fn dump_process_env_once() {
    ENV_DUMP_DONE.get_or_init(|| {
        debug_log("=== [divergence] Process Environment Dump (one-time) ===");
        debug_log(&format!("[divergence] env PATH={:?}", std::env::var("PATH").ok().map(|p| p.chars().take(300).collect::<String>())));
        debug_log(&format!("[divergence] env SHELL={:?}", std::env::var("SHELL").ok()));
        debug_log(&format!("[divergence] env HOME={:?}", std::env::var("HOME").ok()));
        debug_log(&format!("[divergence] env USER={:?}", std::env::var("USER").ok()));
        debug_log(&format!("[divergence] env TMPDIR={:?}", std::env::var("TMPDIR").ok()));
        debug_log(&format!("[divergence] env TMUX={:?}", std::env::var("TMUX").ok()));
        debug_log(&format!("[divergence] env TMUX_TMPDIR={:?}", std::env::var("TMUX_TMPDIR").ok()));
        debug_log(&format!("[divergence] env DIVERGENCE_TMUX_PATH={:?}", std::env::var("DIVERGENCE_TMUX_PATH").ok()));
        debug_log(&format!("[divergence] env TERM={:?}", std::env::var("TERM").ok()));
        debug_log(&format!("[divergence] env __CFBundleIdentifier={:?}", std::env::var("__CFBundleIdentifier").ok()));
        debug_log(&format!("[divergence] current_dir={:?}", std::env::current_dir().ok()));
        debug_log(&format!("[divergence] current_exe={:?}", std::env::current_exe().ok()));
        if let Ok(output) = Command::new("id").arg("-u").output() {
            debug_log(&format!("[divergence] uid={}", String::from_utf8_lossy(&output.stdout).trim()));
        }
        debug_log("=== [divergence] End Process Environment Dump ===");
    });
}

#[derive(Debug, Clone, Default)]
struct LoginShellTmuxContext {
    tmux_path: Option<PathBuf>,
    tmux_tmpdir: Option<String>,
    tmpdir: Option<String>,
}

fn command_with_tmux() -> Command {
    if let Some(ref path) = get_tmux_path() {
        debug_log(&format!("[divergence] command_with_tmux: using resolved tmux binary: {:?}", path));
        let mut cmd = Command::new(path);
        if let Some(ref login_path) = get_login_shell_path() {
            debug_log(&format!("[divergence] command_with_tmux: setting PATH from login shell ({} chars)", login_path.len()));
            cmd.env("PATH", login_path);
        } else {
            debug_log("[divergence] command_with_tmux: no login shell PATH available, using process PATH");
        }
        apply_tmux_context_env(&mut cmd);
        return cmd;
    }
    debug_log("[divergence] command_with_tmux: no resolved tmux path, falling back to bare 'tmux' with login PATH");
    let mut cmd = command_with_login_path("tmux");
    apply_tmux_context_env(&mut cmd);
    cmd
}

fn command_with_login_path(program: &str) -> Command {
    let mut cmd = Command::new(program);
    if let Some(path) = get_login_shell_path() {
        cmd.env("PATH", path);
    }
    cmd
}

fn get_login_shell_path() -> Option<String> {
    LOGIN_SHELL_PATH
        .get_or_init(resolve_login_shell_path)
        .as_ref()
        .cloned()
}

fn get_tmux_path() -> Option<PathBuf> {
    TMUX_PATH.get_or_init(resolve_tmux_path).as_ref().cloned()
}

fn resolve_tmux_path() -> Option<PathBuf> {
    if let Ok(explicit) = std::env::var("DIVERGENCE_TMUX_PATH") {
        let candidate = PathBuf::from(&explicit);
        if is_executable(&candidate) {
            debug_log(&format!("[divergence] tmux path resolved via DIVERGENCE_TMUX_PATH={:?}", explicit));
            return Some(candidate);
        }
    }

    if let Some(found) = get_login_shell_tmux_context().tmux_path {
        debug_log(&format!("[divergence] tmux path resolved via login shell context: {:?}", found));
        return Some(found);
    }

    if let Some(path) = get_login_shell_path() {
        if let Some(found) = find_in_path(&path, "tmux") {
            debug_log(&format!("[divergence] tmux path resolved via login shell PATH: {:?}", found));
            return Some(found);
        }
    }

    if let Ok(path) = std::env::var("PATH") {
        if let Some(found) = find_in_path(&path, "tmux") {
            debug_log(&format!("[divergence] tmux path resolved via process PATH: {:?}", found));
            return Some(found);
        }
    }

    for candidate in [
        "/opt/homebrew/bin/tmux",
        "/usr/local/bin/tmux",
        "/opt/local/bin/tmux",
        "/usr/bin/tmux",
        "/bin/tmux",
    ] {
        let candidate = Path::new(candidate);
        if is_executable(candidate) {
            debug_log(&format!("[divergence] tmux path resolved via hardcoded fallback: {:?}", candidate));
            return Some(candidate.to_path_buf());
        }
    }

    debug_log("[divergence] tmux path resolution failed: tmux binary not found");
    None
}

fn find_in_path(path_value: &str, program: &str) -> Option<PathBuf> {
    for dir in std::env::split_paths(path_value) {
        let candidate = dir.join(program);
        if is_executable(&candidate) {
            return Some(candidate);
        }
    }
    None
}

fn is_executable(path: &Path) -> bool {
    let Ok(metadata) = fs::metadata(path) else {
        return false;
    };
    if !metadata.is_file() {
        return false;
    }
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        metadata.permissions().mode() & 0o111 != 0
    }
    #[cfg(not(unix))]
    {
        true
    }
}

fn run_tmux_command_for_diagnostics(args: &[&str]) -> TmuxCommandDiagnostics {
    match command_with_tmux().args(args).output() {
        Ok(result) => TmuxCommandDiagnostics {
            status_code: result.status.code(),
            stdout: String::from_utf8_lossy(&result.stdout).to_string(),
            stderr: String::from_utf8_lossy(&result.stderr).to_string(),
            error: None,
        },
        Err(err) => TmuxCommandDiagnostics {
            status_code: None,
            stdout: String::new(),
            stderr: String::new(),
            error: Some(err.to_string()),
        },
    }
}

fn resolve_login_shell_path() -> Option<String> {
    for shell in login_shell_candidates() {
        let output = Command::new(&shell)
            .args(["-l", "-c", "echo -n $PATH"])
            .output();

        let Ok(result) = output else {
            debug_log(&format!("[divergence] login shell PATH probe failed for {:?}: could not execute", shell));
            continue;
        };
        if !result.status.success() {
            debug_log(&format!(
                "[divergence] login shell PATH probe failed for {:?}: exit={:?}, stderr={:?}",
                shell,
                result.status.code(),
                String::from_utf8_lossy(&result.stderr).chars().take(200).collect::<String>()
            ));
            continue;
        }

        let path = String::from_utf8_lossy(&result.stdout).trim().to_string();
        if !path.is_empty() {
            debug_log(&format!("[divergence] login shell PATH resolved via {:?} ({} chars)", shell, path.len()));
            return Some(path);
        }
    }

    debug_log("[divergence] login shell PATH probe: no PATH found from any shell candidate");
    None
}

fn apply_tmux_context_env(cmd: &mut Command) {
    let ctx = get_login_shell_tmux_context();
    let process_tmux_tmpdir = std::env::var("TMUX_TMPDIR").ok();
    let process_tmpdir = std::env::var("TMPDIR").ok();

    debug_log(&format!(
        "[divergence] apply_tmux_context_env: process TMUX_TMPDIR={:?}, process TMPDIR={:?}",
        process_tmux_tmpdir, process_tmpdir
    ));
    debug_log(&format!(
        "[divergence] apply_tmux_context_env: login_shell TMUX_TMPDIR={:?}, login_shell TMPDIR={:?}",
        ctx.tmux_tmpdir, ctx.tmpdir
    ));

    // Propagate TMUX_TMPDIR from login shell if not set in process env
    if process_tmux_tmpdir.is_none() {
        if let Some(ref tmux_tmpdir) = ctx.tmux_tmpdir {
            debug_log(&format!("[divergence] apply_tmux_context_env: setting TMUX_TMPDIR={:?} from login shell", tmux_tmpdir));
            cmd.env("TMUX_TMPDIR", tmux_tmpdir);
        }
    } else {
        debug_log("[divergence] apply_tmux_context_env: TMUX_TMPDIR already set in process env, not overriding");
    }

    // Propagate TMPDIR from login shell when it differs from process env.
    // tmux uses TMPDIR as fallback for socket directory (after TMUX_TMPDIR),
    // so a mismatch causes the app to connect to the wrong tmux server.
    // This commonly happens when the app is launched from Finder (production)
    // vs from a terminal (dev mode).
    if let Some(ref login_tmpdir) = ctx.tmpdir {
        let current_tmpdir = process_tmpdir.as_deref().unwrap_or("");
        if current_tmpdir != login_tmpdir.as_str() {
            debug_log(&format!(
                "[divergence] apply_tmux_context_env: TMPDIR MISMATCH detected! process={:?}, login_shell={:?} — propagating login shell value to tmux command",
                current_tmpdir, login_tmpdir
            ));
            cmd.env("TMPDIR", login_tmpdir);
        } else {
            debug_log("[divergence] apply_tmux_context_env: TMPDIR matches between process and login shell — no override needed");
        }
    } else {
        debug_log("[divergence] apply_tmux_context_env: no login shell TMPDIR available for comparison");
    }
}

fn get_login_shell_tmux_context() -> LoginShellTmuxContext {
    LOGIN_SHELL_TMUX_CONTEXT
        .get_or_init(resolve_login_shell_tmux_context)
        .clone()
}

fn resolve_login_shell_tmux_context() -> LoginShellTmuxContext {
    const TMUX_BIN_PREFIX: &str = "__DIVERGENCE_TMUX_CTX__TMUX_BIN=";
    const TMUX_TMPDIR_PREFIX: &str = "__DIVERGENCE_TMUX_CTX__TMUX_TMPDIR=";
    const TMPDIR_PREFIX: &str = "__DIVERGENCE_TMUX_CTX__TMPDIR=";
    const SHELL_PROBE_SCRIPT: &str = r#"
if [ -n "${ZSH_VERSION-}" ]; then
  _divergence_tmux_bin="$(whence -p tmux 2>/dev/null)"
elif [ -n "${BASH_VERSION-}" ]; then
  _divergence_tmux_bin="$(type -P tmux 2>/dev/null)"
else
  _divergence_tmux_bin="$(command -v tmux 2>/dev/null)"
fi
printf '__DIVERGENCE_TMUX_CTX__TMUX_BIN=%s\n' "$_divergence_tmux_bin"
printf '__DIVERGENCE_TMUX_CTX__TMUX_TMPDIR=%s\n' "${TMUX_TMPDIR-}"
printf '__DIVERGENCE_TMUX_CTX__TMPDIR=%s\n' "${TMPDIR-}"
"#;

    for shell in login_shell_candidates() {
        let output = Command::new(&shell)
            .args(["-l", "-i", "-c", SHELL_PROBE_SCRIPT])
            .output();

        let Ok(result) = output else {
            debug_log(&format!(
                "[divergence] login shell tmux context probe failed for {:?}: could not execute",
                shell
            ));
            continue;
        };

        let mut context = LoginShellTmuxContext::default();
        let combined_output = format!(
            "{}\n{}",
            String::from_utf8_lossy(&result.stdout),
            String::from_utf8_lossy(&result.stderr)
        );

        for line in combined_output.lines() {
            if let Some(value) = line.strip_prefix(TMUX_BIN_PREFIX) {
                let candidate = PathBuf::from(value.trim());
                if is_executable(&candidate) {
                    context.tmux_path = Some(candidate);
                }
                continue;
            }

            if let Some(value) = line.strip_prefix(TMUX_TMPDIR_PREFIX) {
                let value = value.trim();
                if !value.is_empty() {
                    context.tmux_tmpdir = Some(value.to_string());
                }
                continue;
            }

            if let Some(value) = line.strip_prefix(TMPDIR_PREFIX) {
                let value = value.trim();
                if !value.is_empty() {
                    context.tmpdir = Some(value.to_string());
                }
            }
        }

        debug_log(&format!(
            "[divergence] login shell tmux context from {:?}: tmux_path={:?}, tmux_tmpdir={:?}, tmpdir={:?}",
            shell, context.tmux_path, context.tmux_tmpdir, context.tmpdir
        ));

        if context.tmux_path.is_some() || context.tmux_tmpdir.is_some() || context.tmpdir.is_some() {
            return context;
        }
    }

    debug_log("[divergence] login shell tmux context probe: no data found from any shell candidate");
    LoginShellTmuxContext::default()
}

fn login_shell_candidates() -> Vec<String> {
    let mut candidates = Vec::new();
    if let Ok(shell) = std::env::var("SHELL") {
        candidates.push(shell);
    }
    candidates.push("/bin/zsh".to_string());
    candidates.push("/bin/bash".to_string());
    candidates
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
    if let Err(error) = fetch_origin_impl(repo_path) {
        eprintln!("git fetch origin failed for '{}': {}", path_to_string(repo_path), error);
    }
}

fn fetch_origin_impl(repo_path: &Path) -> Result<(), String> {
    let primary = Command::new("git")
        .args(["fetch", "origin"])
        .current_dir(repo_path)
        .output()
        .map_err(|error| format!("Failed to execute git fetch origin: {}", error))?;

    if primary.status.success() {
        return Ok(());
    }

    let primary_error = String::from_utf8_lossy(&primary.stderr).trim().to_string();
    let remote_url = get_remote_url(repo_path)?.unwrap_or_default();
    if is_github_ssh_remote(&remote_url) && should_retry_via_github_443(&primary_error) {
        let fallback = Command::new("git")
            .arg("-c")
            .arg("core.sshCommand=ssh -o Hostname=ssh.github.com -o Port=443 -o ConnectTimeout=10 -o StrictHostKeyChecking=accept-new")
            .args(["fetch", "origin"])
            .current_dir(repo_path)
            .output()
            .map_err(|error| format!("Failed to execute git fetch origin fallback: {}", error))?;

        if fallback.status.success() {
            return Ok(());
        }

        let fallback_error = String::from_utf8_lossy(&fallback.stderr).trim().to_string();
        return Err(format!(
            "{} (retry via ssh.github.com:443 failed: {})",
            primary_error, fallback_error
        ));
    }

    Err(primary_error)
}

fn is_github_ssh_remote(remote_url: &str) -> bool {
    (remote_url.starts_with("git@github.com:")
        || remote_url.starts_with("ssh://git@github.com/")
        || remote_url.starts_with("ssh://github.com/"))
        && remote_url.contains("github.com")
}

fn should_retry_via_github_443(error: &str) -> bool {
    let normalized = error.to_ascii_lowercase();
    normalized.contains("github.com port 22")
        || normalized.contains("connection timed out")
        || normalized.contains("connection refused")
        || normalized.contains("no route to host")
        || normalized.contains("network is unreachable")
        || normalized.contains("undefined error: 0")
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

pub fn list_changes(repo_path: &Path) -> Result<Vec<GitChange>, String> {
    let output = Command::new("git")
        .args(["status", "--porcelain=v2", "-z"])
        .current_dir(repo_path)
        .output()
        .map_err(|e| format!("Failed to list git changes: {}", e))?;

    if !output.status.success() {
        return Err(format!(
            "Failed to list git changes: {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }

    let parts = split_nul_terminated_parts(&output.stdout);
    Ok(parse_status_porcelain_v2(&parts))
}

fn split_nul_terminated_parts(bytes: &[u8]) -> Vec<&[u8]> {
    bytes
        .split(|b| *b == 0u8)
        .filter(|part| !part.is_empty())
        .collect()
}

fn parse_status_porcelain_v2(parts: &[&[u8]]) -> Vec<GitChange> {
    let mut changes = Vec::new();
    let mut index = 0;

    while index < parts.len() {
        let part = String::from_utf8_lossy(parts[index]);
        let tag = part.chars().next().unwrap_or('\0');

        match tag {
            '1' => {
                if let Some(change) = parse_porcelain_tracked_entry(&part) {
                    changes.push(change);
                }
            }
            '2' => {
                if let Some(change) = parse_porcelain_renamed_entry(parts, index, &part) {
                    changes.push(change);
                    index += 1;
                }
            }
            'u' => {
                if let Some(change) = parse_porcelain_unmerged_entry(&part) {
                    changes.push(change);
                }
            }
            '?' => {
                changes.push(parse_porcelain_untracked_entry(&part));
            }
            '!' => {
                // ignored; skip
            }
            _ => {
                // Unknown or unexpected entry; skip
            }
        }

        index += 1;
    }

    changes
}

fn parse_porcelain_tracked_entry(part: &str) -> Option<GitChange> {
    let fields: Vec<&str> = part.splitn(9, ' ').collect();
    if fields.len() < 9 {
        return None;
    }
    Some(change_from_xy(fields[8], None, fields[1]))
}

fn parse_porcelain_renamed_entry(parts: &[&[u8]], index: usize, part: &str) -> Option<GitChange> {
    let fields: Vec<&str> = part.splitn(10, ' ').collect();
    if fields.len() < 10 {
        return None;
    }
    let old_path = parts
        .get(index + 1)
        .map(|value| String::from_utf8_lossy(value).into_owned());
    Some(change_from_xy(fields[9], old_path, fields[1]))
}

fn parse_porcelain_unmerged_entry(part: &str) -> Option<GitChange> {
    let fields: Vec<&str> = part.splitn(11, ' ').collect();
    let path = fields.last().copied()?;
    Some(GitChange {
        path: path.to_string(),
        old_path: None,
        status: 'U',
        staged: true,
        unstaged: true,
        untracked: false,
    })
}

fn parse_porcelain_untracked_entry(part: &str) -> GitChange {
    let path = part.strip_prefix("? ").unwrap_or("");
    GitChange {
        path: path.to_string(),
        old_path: None,
        status: '?',
        staged: false,
        unstaged: false,
        untracked: true,
    }
}

pub fn get_diff(repo_path: &Path, file_path: &Path, mode: DiffMode) -> Result<GitDiff, String> {
    let rel_path = file_path.strip_prefix(repo_path).unwrap_or(file_path);
    let rel_string = path_to_string(rel_path);

    let diff = run_diff(repo_path, &rel_string, mode)?;
    let mut diff_text = diff;

    if diff_text.is_empty() && matches!(mode, DiffMode::Working) && is_untracked(repo_path, &rel_string)
    {
        diff_text = run_untracked_diff(repo_path, &rel_string)?;
    }

    let is_binary = diff_text.contains("Binary files") || diff_text.contains("GIT binary patch");

    Ok(GitDiff {
        diff: diff_text,
        is_binary,
    })
}

fn change_from_xy(path: &str, old_path: Option<String>, xy: &str) -> GitChange {
    let mut chars = xy.chars();
    let staged_status = chars.next().unwrap_or('.');
    let unstaged_status = chars.next().unwrap_or('.');

    let staged = staged_status != '.';
    let unstaged = unstaged_status != '.';
    let status = if staged_status != '.' {
        staged_status
    } else if unstaged_status != '.' {
        unstaged_status
    } else {
        '?'
    };

    GitChange {
        path: path.to_string(),
        old_path,
        status,
        staged,
        unstaged,
        untracked: false,
    }
}

fn run_diff(repo_path: &Path, rel_path: &str, mode: DiffMode) -> Result<String, String> {
    let mut args = vec!["diff", "--no-color", "--patch"];
    if matches!(mode, DiffMode::Staged) {
        args.push("--cached");
    }
    args.push("--");
    args.push(rel_path);

    run_git_diff(repo_path, &args)
}

fn run_untracked_diff(repo_path: &Path, rel_path: &str) -> Result<String, String> {
    let args = ["diff", "--no-color", "--patch", "--no-index", "--", "/dev/null", rel_path];
    run_git_diff(repo_path, &args)
}

fn run_git_diff(repo_path: &Path, args: &[&str]) -> Result<String, String> {
    let output = Command::new("git")
        .args(args)
        .current_dir(repo_path)
        .output()
        .map_err(|e| format!("Failed to execute git diff: {}", e))?;

    let code = output.status.code().unwrap_or(0);
    if code > 1 {
        return Err(format!(
            "Git diff failed: {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }

    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

fn is_untracked(repo_path: &Path, rel_path: &str) -> bool {
    let status = Command::new("git")
        .args(["ls-files", "--error-unmatch", "--", rel_path])
        .current_dir(repo_path)
        .status();

    match status {
        Ok(result) => !result.success(),
        Err(_) => false,
    }
}

#[derive(Debug, Clone)]
pub struct TmuxPaneStatus {
    pub alive: bool,
    pub exit_code: Option<i32>,
}

pub fn spawn_tmux_automation_session(
    session_name: &str,
    command: &str,
    cwd: &str,
    _log_path: &str,
    env_vars: &[(String, String)],
) -> Result<(), String> {
    validate_automation_session_name(session_name)?;

    // Write the wrapper command to a temporary script file to avoid quoting hell.
    // tmux new-session passes its command through a shell layer, and the wrapper
    // command contains single-quoted paths, shell variables ($, ${}, PIPESTATUS),
    // pipes, and && chains — making inline quoting extremely fragile.
    let script_path = write_automation_script(cwd, session_name, command)?;
    run_tmux_new_session(session_name, cwd, env_vars, &script_path)?;
    set_tmux_remain_on_exit(session_name);

    // Note: logging is handled by `tee -a` in the wrapper script itself.
    // We intentionally do NOT use pipe-pane here because it would race with
    // tee and produce duplicated/interleaved output in the same log file.

    Ok(())
}

fn validate_automation_session_name(session_name: &str) -> Result<(), String> {
    if !session_name.starts_with("divergence-") {
        return Err("Automation session name must start with 'divergence-'".to_string());
    }
    Ok(())
}

fn write_automation_script(cwd: &str, session_name: &str, command: &str) -> Result<PathBuf, String> {
    let script_dir = PathBuf::from(cwd).join(".divergence").join("automation-runs");
    fs::create_dir_all(&script_dir)
        .map_err(|error| format!("Failed to create automation-runs directory: {}", error))?;

    let script_path = script_dir.join(format!("{}.sh", session_name));
    fs::write(&script_path, format!("#!/usr/bin/env bash\n{}\n", command))
        .map_err(|error| format!("Failed to write automation script: {}", error))?;

    set_script_permissions(&script_path);
    Ok(script_path)
}

fn set_script_permissions(script_path: &Path) {
    let _ = script_path;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = fs::set_permissions(script_path, fs::Permissions::from_mode(0o755));
    }
}

fn run_tmux_new_session(
    session_name: &str,
    cwd: &str,
    env_vars: &[(String, String)],
    script_path: &Path,
) -> Result<(), String> {
    let script_path_str = path_to_string(script_path);
    let bash_command = format!("bash -l {}", shell_escape(&script_path_str));

    let mut cmd = command_with_tmux();
    cmd.args([
        "new-session",
        "-d",
        "-s",
        session_name,
        "-x",
        "200",
        "-y",
        "50",
        "-c",
        cwd,
    ]);
    for (key, value) in env_vars {
        cmd.args(["-e", &format!("{}={}", key, value)]);
    }
    cmd.arg(&bash_command);

    let output = cmd
        .output()
        .map_err(|error| format!("Failed to execute tmux new-session: {}", error))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Failed to create tmux session: {}", stderr));
    }

    Ok(())
}

fn set_tmux_remain_on_exit(session_name: &str) {
    let _ = command_with_tmux()
        .args(["set-option", "-t", session_name, "remain-on-exit", "on"])
        .output();
}

pub fn query_tmux_pane_status(session_name: &str) -> Result<TmuxPaneStatus, String> {
    // Remove TMUX env var so tmux doesn't fall back to the current session
    // when the target session doesn't exist. Without this, if the Tauri process
    // is started from within a tmux session, tmux silently queries the parent
    // session instead of erroring, causing stuck "alive" status.
    let output = command_with_tmux()
        .env_remove("TMUX")
        .args([
            "display-message",
            "-t",
            session_name,
            "-p",
            "#{pane_dead}|#{pane_dead_status}",
        ])
        .output();

    let result = match output {
        Ok(r) => r,
        Err(err) => {
            if err.kind() == ErrorKind::NotFound {
                return Err("tmux not found".to_string());
            }
            return Err(format!("Failed to execute tmux: {}", err));
        }
    };

    if !result.status.success() {
        let stderr = String::from_utf8_lossy(&result.stderr);
        if stderr.contains("can't find session")
            || stderr.contains("no server running")
            || stderr.contains("failed to connect to server")
            || stderr.contains("session not found")
        {
            return Err("session_not_found".to_string());
        }
        return Err(format!("Failed to query tmux pane status: {}", stderr));
    }

    let stdout = String::from_utf8_lossy(&result.stdout).trim().to_string();
    let parts: Vec<&str> = stdout.split('|').collect();
    if parts.len() < 2 {
        return Ok(TmuxPaneStatus {
            alive: true,
            exit_code: None,
        });
    }

    let pane_dead = parts[0] == "1";
    let exit_code = if pane_dead {
        parts[1].trim().parse::<i32>().ok()
    } else {
        None
    };

    Ok(TmuxPaneStatus {
        alive: !pane_dead,
        exit_code,
    })
}

pub fn read_file_tail(path: &str, max_bytes: u64) -> Result<Option<String>, String> {
    let file_path = Path::new(path);
    if !file_path.exists() {
        return Ok(None);
    }

    let metadata = fs::metadata(file_path)
        .map_err(|e| format!("Failed to read file metadata: {}", e))?;
    let file_size = metadata.len();

    if file_size == 0 {
        return Ok(Some(String::new()));
    }

    use std::io::{Read, Seek, SeekFrom};
    let mut file = fs::File::open(file_path)
        .map_err(|e| format!("Failed to open file: {}", e))?;

    let read_start = file_size.saturating_sub(max_bytes);

    file.seek(SeekFrom::Start(read_start))
        .map_err(|e| format!("Failed to seek: {}", e))?;

    let mut buffer = Vec::new();
    file.read_to_end(&mut buffer)
        .map_err(|e| format!("Failed to read file: {}", e))?;

    Ok(Some(String::from_utf8_lossy(&buffer).to_string()))
}

pub fn read_file_if_exists(path: &str) -> Result<Option<String>, String> {
    let file_path = Path::new(path);
    if !file_path.exists() {
        return Ok(None);
    }

    let contents = fs::read_to_string(file_path)
        .map_err(|e| format!("Failed to read file: {}", e))?;

    Ok(Some(contents))
}

fn shell_escape(value: &str) -> String {
    format!("'{}'", value.replace('\'', "'\\''"))
}

pub fn list_branch_changes(repo_path: &Path) -> Result<BranchChanges, String> {
    let base_ref = find_base_ref(repo_path)?;
    let Some(ref base) = base_ref else {
        return Ok(BranchChanges {
            base_ref: None,
            changes: vec![],
        });
    };

    let output = Command::new("git")
        .args([
            "diff",
            "--name-status",
            "-z",
            &format!("{}...HEAD", base),
        ])
        .current_dir(repo_path)
        .output()
        .map_err(|e| format!("Failed to execute git diff: {}", e))?;

    let code = output.status.code().unwrap_or(0);
    if code > 1 {
        return Err(format!(
            "Git diff failed: {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }

    let parts: Vec<&[u8]> = output
        .stdout
        .split(|b| *b == 0u8)
        .filter(|part| !part.is_empty())
        .collect();

    let mut changes = Vec::new();
    let mut i = 0;
    while i < parts.len() {
        let status_str = String::from_utf8_lossy(parts[i]).to_string();
        let status_char = status_str.chars().next().unwrap_or('?');

        if status_char == 'R' || status_char == 'C' {
            // Renames/copies have two paths: old_path and new_path
            if i + 2 < parts.len() {
                let old_path = String::from_utf8_lossy(parts[i + 1]).to_string();
                let new_path = String::from_utf8_lossy(parts[i + 2]).to_string();
                changes.push(GitChange {
                    path: new_path,
                    old_path: Some(old_path),
                    status: status_char,
                    staged: false,
                    unstaged: false,
                    untracked: false,
                });
                i += 3;
            } else {
                i += 1;
            }
        } else if i + 1 < parts.len() {
            let path = String::from_utf8_lossy(parts[i + 1]).to_string();
            changes.push(GitChange {
                path,
                old_path: None,
                status: status_char,
                staged: false,
                unstaged: false,
                untracked: false,
            });
            i += 2;
        } else {
            i += 1;
        }
    }

    Ok(BranchChanges {
        base_ref,
        changes,
    })
}

pub fn get_branch_diff(repo_path: &Path, file_path: &Path) -> Result<GitDiff, String> {
    let base_ref = find_base_ref(repo_path)?;
    let Some(ref base) = base_ref else {
        return Err("No base branch found".to_string());
    };
    let rel_path = file_path.strip_prefix(repo_path).unwrap_or(file_path);
    let diff_text = run_git_diff(
        repo_path,
        &[
            "diff",
            "--no-color",
            "--patch",
            &format!("{}...HEAD", base),
            "--",
            &rel_path.to_string_lossy(),
        ],
    )?;
    let is_binary = diff_text.contains("Binary files") || diff_text.contains("GIT binary patch");
    Ok(GitDiff {
        diff: diff_text,
        is_binary,
    })
}
