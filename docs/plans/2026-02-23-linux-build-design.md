# Linux Build Support (Ubuntu/Debian)

Date: 2026-02-23
Branch: linux-build
Approach: Minimal platform abstraction (Approach A)

## Targets

- x86_64 only
- .deb + AppImage
- Local build + CI/CD publish

## Changes

### 1. Shell detection (`src/shared/api/pty.api.ts`)

Replace hardcoded `/bin/zsh` with `getDefaultShell()` helper:
- reads `$SHELL` env var
- falls back to `/bin/bash`
- fix `SHELL` env var in spawn options to match

### 2. Platform-aware logging (`src-tauri/src/git.rs`)

- Linux: `~/.local/share/divergence/`
- macOS: `~/Library/Logs/Divergence/` (unchanged)

### 3. Usage limits hidden on Linux

- `#[cfg(target_os = "macos")]` on `read_claude_keychain()` + caller
- Conditionally hide `<UsageLimitsButton />` on Linux
- Rust commands still compile, just return "not found"

### 4. Error tip path (`TmuxPanel.container.tsx`)

Show correct log path per platform in error messages.

### 5. CI/CD publish (`publish.yml`)

- Add `ubuntu-22.04` / `x86_64-unknown-linux-gnu` to matrix
- Install Linux system deps (libwebkit2gtk-4.1-dev, libssl-dev, libgtk-3-dev, etc.)
- Skip Apple signing on Linux
- Produce .deb + .AppImage

### 6. CI PR checks (`ci.yml`)

- Add Linux binary for Chaperone download
- Add ubuntu-22.04 to CI matrix

## Files touched

1. `src/shared/api/pty.api.ts`
2. `src-tauri/src/git.rs`
3. `src-tauri/src/usage_limits.rs`
4. `src/widgets/main-area/ui/MainArea.presentational.tsx`
5. `src/widgets/main-area/ui/TmuxPanel.container.tsx`
6. `.github/workflows/publish.yml`
7. `.github/workflows/ci.yml`
