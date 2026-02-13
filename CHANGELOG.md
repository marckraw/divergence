# divergence

## 0.15.3

### Patch Changes

- e388b0e: Fix infinite loop in automation polling: add 4-hour maximum timeout to pollUntilDone to prevent stuck automation runs from blocking the task queue indefinitely. Also fix DB finalization so timed-out runs are correctly marked as "error" instead of remaining in "running" status.

## 0.15.2

### Patch Changes

- 370e1e1: Fix updateAutomationRun clobbering unrelated fields with null when optional parameters are omitted

## 0.15.1

### Patch Changes

- eb29ba4: Fix drizzle sqlite-proxy to return empty array instead of [undefined] when a single-row query yields no results.
- f3c5bcb: Fix double path separators in file quick switcher when root path has trailing slash or relative path has leading slash
- 6810f75: Fix GitHub inbox polling failure cascade where a single insertInboxEvent error would abort processing of all remaining pull requests and repositories, and prevent poll state from being updated.

## 0.15.0

### Minor Changes

- 407506b: Automation runs now create a fresh divergence (branch-isolated clone) before spawning the agent, keeping the base project directory untouched. The new divergence appears in the sidebar after each run.

## 0.14.1

### Patch Changes

- f657704: Fix merge detection effect cascade where detecting a merge caused unnecessary effect re-triggers, interval resets, and silently skipped divergence checks.
- b4e055c: Fix off-by-one bug in computeNextScheduledRunAtMs: when the computed next run time landed exactly on the current time (or missed intervals aligned to exact multiples), Math.ceil returned 0, causing the function to return the current time instead of a future slot. This could trigger immediate re-runs in a tight loop. Switched to Math.floor + 1 to guarantee the result always lands strictly in the future.

## 0.14.0

### Minor Changes

- f278ae5: Add dismiss/archive functionality for completed automation runs in Task Center. Users can dismiss individual tasks or clear all recent tasks at once. Dismissed runs are soft-deleted and persist across app restarts.

### Patch Changes

- 963a02b: Fix updateAutomationRun silently nulling out omitted optional fields (e.g. startedAtMs) when only a subset of fields is provided by the caller.

## 0.13.1

### Patch Changes

- 99e9b24: Deduplicate listAutomations() calls in automation run poller to avoid redundant DB queries

## 0.13.0

### Minor Changes

- f983828: Add usage limits popover showing real-time Claude Code and Codex API usage with colored utilization bars, reset countdowns, and 60s auto-polling.

## 0.12.0

### Minor Changes

- 55bdb8e: Replace legacy database initialization with versioned inline migration system. Wrap project deletion in a transaction for atomicity. Complete Drizzle ORM migration.

## 0.11.0

### Minor Changes

- 8ee984d: Add resizable left sidebar with drag handle. Drag the edge to resize (180–480px), double-click to reset to default width.

## 0.10.0

### Minor Changes

- 39cb60e: Add "View Terminal" button to task inspector for attaching to automation tmux sessions, and "Keep Session Alive" toggle to preserve sessions after agent completion

### Patch Changes

- a880bf3: ability to remove files from file explorer

## 0.9.0

### Minor Changes

- e9eeb66: Add Work mode productivity systems:

  - introduce Work sidebar navigation with Inbox, Task Center, and Automations
  - add scheduled automation runs (manual + interval), automation run tracking, and inbox events
  - add GitHub PR inbox polling support using `GITHUB_TOKEN`
  - replace the old task drawer with a full Task Center screen and inspect modal
  - add task inspect liveness and command output tail visibility for automation runs

## 0.8.1

### Patch Changes

- e88fa00: Improve TMUX reliability in installed builds by aligning backend TMUX resolution with login-interactive shell context, and add TMUX diagnostics commands for troubleshooting session discovery.

## 0.8.0

### Minor Changes

- 6ef1241: Fix CI chaperone execution by installing the standalone release binary directly from GitHub Releases instead of using `bunx`. Add SHA256 verification during download for integrity.

## 0.7.0

### Minor Changes

- adf84b8: Add task center for background task management, move tasks button to top bar, extract utilities and add unit tests

## 0.6.3

### Patch Changes

- eb35b1c: shortcut and button to toggle sidepanel right

## 0.6.2

### Patch Changes

- a15b556: Add keyboard shortcut to toggle the right side panel and add search functionality to tmux sessions panel

## 0.6.1

### Patch Changes

- 13dd3b0: Improve tmux session discovery in release builds by resolving the tmux binary path.

## 0.6.0

### Minor Changes

- bae6381: Add file quick switcher (Cmd+Shift+O) to search and open project files in the editor.

## 0.5.0

### Minor Changes

- e1b4d75: Add Branch Changes mode to the Changes Panel that compares the current branch against its base branch (e.g., origin/main), showing all files changed by the branch.

## 0.4.3

### Patch Changes

- 9ba508d: Add a toggleable sidebar with Cmd+B shortcut and UI controls.

## 0.4.2

### Patch Changes

- b9b7ae5: Fix tmux session discovery in release builds by using a login-shell PATH.

## 0.4.1

### Patch Changes

- 8cf766b: Harden tmux panel ownership handling and prevent killing non-Divergence sessions.

## 0.4.0

### Minor Changes

- d876579: Add manual check-for-updates trigger, error visibility, version display in Settings, and dismissible update banner

## 0.3.0

### Minor Changes

- e9c417f: Add a Changes panel with git diff viewing and quick edit flow.

## 0.2.6

### Patch Changes

- 5d45394: Add quick editor autocomplete for words and import paths.

## 0.2.5

### Patch Changes

- 40e7a5e: Fix Cmd+T to open the New Divergence modal for the active project.

## 0.2.4

### Patch Changes

- e595394: code signing

## 0.2.3

### Patch Changes

- 86ae3a2: update deps again to release

## 0.2.2

### Patch Changes

- 159bc1d: fix release again

## 0.2.1

### Patch Changes

- 2e5ee16: fix publishing

## 0.2.0

### Minor Changes

- aad38a5: first release
