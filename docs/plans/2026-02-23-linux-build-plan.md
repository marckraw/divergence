# Linux Build Support — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make Divergence build and run on Ubuntu/Debian (x86_64), with CI/CD producing .deb + AppImage artifacts.

**Architecture:** Minimal platform abstraction — fix hardcoded macOS assumptions in 7 files. Add Rust command for shell detection, cfg-gate macOS-only code, add Linux to CI matrices.

**Tech Stack:** Tauri 2, Rust, TypeScript/React, GitHub Actions

**Design doc:** `docs/plans/2026-02-23-linux-build-design.md`

---

### Task 1: Add `get_default_shell` Rust command

The PTY layer hardcodes `/bin/zsh`. We need a Tauri command that returns the user's default shell from `$SHELL` env var, falling back to `/bin/bash` on Linux, `/bin/zsh` on macOS.

**Files:**
- Modify: `src-tauri/src/commands.rs`
- Modify: `src-tauri/src/lib.rs:95-130` (invoke_handler registration)

**Step 1: Add command to `commands.rs`**

Add at the end of the file, before any closing braces or after the last command function:

```rust
#[tauri::command]
pub fn get_default_shell() -> String {
    if let Ok(shell) = std::env::var("SHELL") {
        if !shell.is_empty() {
            return shell;
        }
    }
    if cfg!(target_os = "macos") {
        "/bin/zsh".to_string()
    } else {
        "/bin/bash".to_string()
    }
}
```

**Step 2: Register command in `lib.rs`**

In `src-tauri/src/lib.rs`, add `commands::get_default_shell` to the `invoke_handler` list (line ~129, after `usage_limits::fetch_codex_usage`):

```rust
            usage_limits::fetch_codex_usage,
            commands::get_default_shell,
```

**Step 3: Verify Rust compiles**

Run: `cargo check` in `src-tauri/`
Expected: compiles clean

**Step 4: Commit**

```
feat(commands): add get_default_shell command
```

---

### Task 2: Replace hardcoded `/bin/zsh` in PTY API

**Files:**
- Modify: `src/shared/api/pty.api.ts`

**Step 1: Add shell detection at top of file**

After the existing imports (line 1), add:

```typescript
import { invoke } from "@tauri-apps/api/core";

let cachedShell: string | null = null;

async function getDefaultShell(): Promise<string> {
  if (cachedShell) return cachedShell;
  try {
    cachedShell = await invoke<string>("get_default_shell");
  } catch {
    cachedShell = "/bin/bash";
  }
  return cachedShell;
}
```

**Step 2: Convert spawn functions to async and use `getDefaultShell()`**

Replace `spawnLoginPty`:
```typescript
export async function spawnLoginPty(options: SpawnPtyBaseOptions): Promise<IPty> {
  const shell = await getDefaultShell();
  return spawn(shell, ["-l"], {
    cols: options.cols,
    rows: options.rows,
    cwd: options.cwd,
    env: options.env,
  });
}
```

Replace `spawnInteractiveShellPty`:
```typescript
export async function spawnInteractiveShellPty(options: SpawnPtyBaseOptions): Promise<IPty> {
  const shell = await getDefaultShell();
  return spawn(shell, ["-l", "-i"], {
    cols: options.cols,
    rows: options.rows,
    cwd: options.cwd,
    env: options.env,
  });
}
```

Replace `spawnTmuxPty`:
```typescript
export async function spawnTmuxPty(options: SpawnTmuxPtyOptions): Promise<IPty> {
  const shell = await getDefaultShell();
  return spawn(shell, ["-l", "-i", "-c", options.tmuxCommand], {
    cols: options.cols,
    rows: options.rows,
    cwd: options.cwd,
    env: {
      TERM: "xterm-256color",
      COLORTERM: "truecolor",
      SHELL: shell,
      DIVERGENCE_APP: "1",
      DIVERGENCE_TMUX_SESSION: options.sessionName,
      DIVERGENCE_TMUX_CWD: options.cwd,
      DIVERGENCE_TMUX_HISTORY_LIMIT: String(options.historyLimit),
      ...options.env,
    },
  });
}
```

Replace `runLoginShellCommand` spawn call (inside the Promise, line 80):
```typescript
export async function runLoginShellCommand(
  options: RunLoginShellCommandOptions
): Promise<RunLoginShellCommandResult> {
  const timeoutMs = options.timeoutMs ?? 1000 * 60 * 20;
  const outputLimitChars = options.outputLimitChars ?? 20_000;
  const outputTailChars = options.outputTailChars ?? 4000;
  const outputUpdateIntervalMs = options.outputUpdateIntervalMs ?? 600;
  const decoder = new TextDecoder();
  const shell = await getDefaultShell();

  return new Promise((resolve, reject) => {
    const pty = spawn(shell, ["-l", "-c", options.command], {
      cols: 120,
      rows: 24,
      cwd: options.cwd,
      env: {
        TERM: "xterm-256color",
        COLORTERM: "truecolor",
        SHELL: shell,
        DIVERGENCE_APP: "1",
        ...options.env,
      },
    });
```

(rest of function body unchanged)

**Step 3: Fix all callers of now-async functions**

Search for all callers of `spawnLoginPty`, `spawnInteractiveShellPty`, `spawnTmuxPty` across the codebase. Each call site needs `await` added. Find them with:

```bash
rg "spawnLoginPty\(|spawnInteractiveShellPty\(|spawnTmuxPty\(" --type ts --type tsx
```

Update each call site to `await` the result. The callers are likely already in async contexts (container components with useEffect, or other async functions), so adding `await` should be straightforward.

**Step 4: Verify TypeScript compiles**

Run: `npm run typecheck`
Expected: no errors

**Step 5: Commit**

```
feat(pty): replace hardcoded /bin/zsh with dynamic shell detection
```

---

### Task 3: Platform-aware log directory in Rust

**Files:**
- Modify: `src-tauri/src/git.rs:11-16`

**Step 1: Replace log directory logic**

Replace lines 13-16 in `git.rs`:

```rust
        let log_dir = dirs::home_dir()
            .map(|h| h.join("Library/Logs/Divergence"))
            .unwrap_or_else(|| PathBuf::from("/tmp"));
```

With:

```rust
        let log_dir = dirs::home_dir()
            .map(|h| {
                if cfg!(target_os = "macos") {
                    h.join("Library/Logs/Divergence")
                } else {
                    h.join(".local/share/divergence/logs")
                }
            })
            .unwrap_or_else(|| PathBuf::from("/tmp"));
```

**Step 2: Verify Rust compiles**

Run: `cargo check` in `src-tauri/`
Expected: compiles clean

**Step 3: Run clippy**

Run: `cargo clippy -- -D warnings` in `src-tauri/`
Expected: no warnings

**Step 4: Commit**

```
fix(git): use XDG-compliant log dir on Linux
```

---

### Task 4: cfg-gate macOS Keychain + hide usage limits on Linux

**Files:**
- Modify: `src-tauri/src/usage_limits.rs:82,331-346,352-359`
- Modify: `src/widgets/main-area/ui/MainArea.presentational.tsx:247`

**Step 1: Gate `read_claude_keychain` in `usage_limits.rs`**

Wrap the function (lines 331-346):

```rust
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
```

**Step 2: Remove `Command` import if unused on non-macOS**

The `use std::process::Command;` import at line 5 is only used by `read_claude_keychain`. To avoid dead-code warnings on Linux, gate it:

```rust
#[cfg(target_os = "macos")]
use std::process::Command;
```

**Step 3: Hide `UsageLimitsButton` on Linux**

In `src/widgets/main-area/ui/MainArea.presentational.tsx` at line 247, wrap with platform check:

```tsx
          {!navigator.platform.includes("Linux") && <UsageLimitsButton />}
```

**Step 4: Verify both compile**

Run: `cargo check` in `src-tauri/` AND `npm run typecheck`
Expected: both clean

**Step 5: Commit**

```
feat(usage-limits): disable on Linux, cfg-gate macOS keychain
```

---

### Task 5: Fix error tip log path in TmuxPanel

**Files:**
- Modify: `src/widgets/main-area/ui/TmuxPanel.container.tsx:253`

**Step 1: Replace hardcoded macOS path**

Replace line 253:

```tsx
                      Tip: Check ~/Library/Logs/Divergence/tmux-debug.log for detailed Rust-side diagnostics.
```

With:

```tsx
                      Tip: Check {navigator.platform.includes("Linux") ? "~/.local/share/divergence/logs/tmux-debug.log" : "~/Library/Logs/Divergence/tmux-debug.log"} for detailed Rust-side diagnostics.
```

**Step 2: Verify TypeScript compiles**

Run: `npm run typecheck`
Expected: clean

**Step 3: Commit**

```
fix(tmux): show correct log path per platform
```

---

### Task 6: Add Linux to publish workflow

**Files:**
- Modify: `.github/workflows/publish.yml`

**Step 1: Add Linux to build matrix**

After line 26 (`target: x86_64-apple-darwin`), add:

```yaml
          - runner: ubuntu-22.04
            target: x86_64-unknown-linux-gnu
```

**Step 2: Add Linux system deps step**

After the `npm ci` step (line 40) and before the Rust toolchain step, add:

```yaml
      - name: Install Linux dependencies
        if: runner.os == 'Linux'
        run: |
          sudo apt-get update
          sudo apt-get install -y \
            libwebkit2gtk-4.1-dev \
            libssl-dev \
            libgtk-3-dev \
            libayatana-appindicator3-dev \
            librsvg2-dev \
            patchelf
```

**Step 3: Gate Apple certificate step to macOS only**

Add `if: runner.os == 'macOS'` to the "Import Apple certificate" step (line 50):

```yaml
      - name: Import Apple certificate
        if: runner.os == 'macOS'
        env:
```

**Step 4: Split build step — macOS vs Linux env vars**

The "Build and release" step has Apple-specific env vars. Gate them:

Replace the entire build step with:

```yaml
      - name: Build and release
        uses: tauri-apps/tauri-action@v0
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}
          TAURI_SIGNING_PRIVATE_KEY_PASSWORD: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY_PASSWORD }}
          APPLE_SIGNING_IDENTITY: ${{ runner.os == 'macOS' && secrets.APPLE_SIGNING_IDENTITY || '' }}
          APPLE_ID: ${{ runner.os == 'macOS' && secrets.APPLE_ID || '' }}
          APPLE_PASSWORD: ${{ runner.os == 'macOS' && secrets.APPLE_ID_PASSWORD || '' }}
          APPLE_TEAM_ID: ${{ runner.os == 'macOS' && secrets.APPLE_TEAM_ID || '' }}
        with:
          tagName: ${{ inputs.tag || github.ref_name }}
          releaseName: ${{ inputs.tag || github.ref_name }}
          releaseDraft: false
          prerelease: false
          includeUpdaterJson: true
          args: --target ${{ matrix.target }}
```

**Step 5: Gate keychain cleanup to macOS**

```yaml
      - name: Cleanup keychain
        if: always() && runner.os == 'macOS'
        run: security delete-keychain $RUNNER_TEMP/app-signing.keychain-db 2>/dev/null || true
```

**Step 6: Commit**

```
feat(ci): add Linux x86_64 to publish workflow
```

---

### Task 7: Add Linux to CI workflow

**Files:**
- Modify: `.github/workflows/ci.yml`

**Step 1: Add matrix strategy for multi-OS**

Replace `runs-on: macos-latest` (line 8) with a matrix:

```yaml
  check:
    strategy:
      fail-fast: false
      matrix:
        include:
          - runner: macos-latest
          - runner: ubuntu-22.04
    runs-on: ${{ matrix.runner }}
```

**Step 2: Update Chaperone install to support Linux**

Replace the architecture detection in the "Install Chaperone" step (lines 27-30):

```yaml
        run: |
          OS="$(uname -s)"
          ARCH="$(uname -m)"
          case "$OS" in
            Darwin)
              case "$ARCH" in
                arm64|aarch64) CHAPERONE_ASSET="chaperone-darwin-arm64" ;;
                x86_64) CHAPERONE_ASSET="chaperone-darwin-x64" ;;
                *) echo "Unsupported macOS architecture: $ARCH" && exit 1 ;;
              esac
              ;;
            Linux)
              case "$ARCH" in
                x86_64) CHAPERONE_ASSET="chaperone-linux-x64" ;;
                aarch64) CHAPERONE_ASSET="chaperone-linux-arm64" ;;
                *) echo "Unsupported Linux architecture: $ARCH" && exit 1 ;;
              esac
              ;;
            *) echo "Unsupported OS: $OS" && exit 1 ;;
          esac
```

Also replace `shasum` with `sha256sum` on Linux. Change the checksum line:

```yaml
          if command -v shasum &>/dev/null; then
            echo "${CHAPERONE_SHA}  $RUNNER_TEMP/chaperone" | shasum -a 256 -c -
          else
            echo "${CHAPERONE_SHA}  $RUNNER_TEMP/chaperone" | sha256sum -c -
          fi
```

**Step 3: Add Linux system deps for Cargo check/clippy**

After `npm ci` step, add:

```yaml
      - name: Install Linux dependencies
        if: runner.os == 'Linux'
        run: |
          sudo apt-get update
          sudo apt-get install -y \
            libwebkit2gtk-4.1-dev \
            libssl-dev \
            libgtk-3-dev \
            libayatana-appindicator3-dev \
            librsvg2-dev
```

**Step 4: Commit**

```
feat(ci): add Linux to CI matrix with cross-platform Chaperone
```

---

### Task 8: Run all post-task checks

**Step 1:** `npm install`
**Step 2:** `npm run test:pure`
**Step 3:** `npm run test:unit`
**Step 4:** `chaperone check --fix`
**Step 5:** `cargo clippy -- -D warnings` in `src-tauri/`
**Step 6:** Fix any issues found, commit fixes

---

## Unresolved questions

- Does `tauri-plugin-pty`'s `spawn` work unchanged on Linux or does it need extra config?
- Will the tray icon (`tray-iconTemplate@2x.png`) render correctly on Linux with appindicator?
- `on_window_event` CloseRequested hides to tray — does this work on Linux without a tray icon showing?
