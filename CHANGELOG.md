# divergence

## 0.41.0

### Minor Changes

- 0120566: Add persistent layout tabs so each tab owns its own pane group and users can switch workspaces without disturbing existing pane arrangements. This also adds a stage tab bar, tab-focused keyboard shortcuts, and quick switcher support for opening selections in a new tab.

## 0.40.0

### Minor Changes

- 8d57455: Introduce a persistent stage layout that lets terminal and agent sessions share split panes, swap the focused pane's content through search, and reuse pane-aware sidebars and shortcuts across session types.

## 0.39.0

### Minor Changes

- 25634ea: Show changed files in agent conversation session header as a collapsible tree view, extracted from session edit activities

## 0.38.1

### Patch Changes

- 0892b15: fix: show individual files inside new folders in agent session changes tab

  Previously, when a new folder with new files was created, only the folder was displayed in the changes tree without its child files. This was because `git status --porcelain=v2` defaults to showing untracked directories as a single entry. Adding `--untracked-files=all` ensures git reports each individual untracked file, allowing the changes tree to display a full expandable hierarchy.

## 0.38.0

### Minor Changes

- 96a42cb: Add skill discovery and slash command autocomplete to agent session composer. Scans Claude Code commands/skills directories and Codex skills directories (both global and project-level) to build a unified skill catalog. Typing `/` in the composer triggers an autocomplete dropdown showing matching skills with keyboard navigation. Claude Code Skill tool invocations are now tracked as distinct "skill" activities in the agent timeline with dedicated grouping and summaries.

## 0.37.0

### Minor Changes

- d282cd6: Robust CLI binary detection with login shell and fnm fallbacks, and CLI version display in session header and settings

## 0.36.2

### Patch Changes

- da3b925: Migrate to chaperone v0.5.0 presets (pure-functions, presentational-components) and bump CI version

## 0.36.1

### Patch Changes

- a2ca05b: Fix MCP tool calls falsely showing ERROR badges in the Codex provider. The error status check used `is_some()` which treated JSON `null` error fields as actual errors, causing all MCP tool activities to appear failed even when they returned valid results. Also add missing approval handler for `item/mcpToolCall/requestApproval` to prevent potential hangs when Codex requests MCP tool approval.

## 0.36.0

### Minor Changes

- 126cc42: Add tabbed sidebar to agent session view with Changes, Linear, and Queue tabs. Linear tab fetches project issues from Linear API and populates the agent composer with a formatted prompt on send. Queue tab manages pre-drafted prompts scoped to the session's project or workspace. Both tabs inject text into the agent composer via an imperative ref, letting the user review before sending.

## 0.35.0

### Minor Changes

- 39954e7: Add a "View" tab to the quick edit drawer for markdown files (.md, .mdx, .markdown) that renders the file content using the same Markdown component used in agent session chat messages, providing a read-only rendered preview alongside the existing Diff and Edit tabs.

## 0.34.0

### Minor Changes

- 952da73: Add a changes tree sidebar to agent session view showing working directory and branch file changes with status badges, folder collapsing, and a quick-edit drawer with CodeMirror editor and diff viewer. Migrate shared utilities (git changes, editor theme, file info, quick edit, changes tree) to the shared layer following FSD-lite architecture.

### Patch Changes

- 8832b83: Fix flickering agent session tabs when multiple sessions are active simultaneously. Tabs are now sorted by creation time instead of last-updated time, preventing constant reordering as sessions receive messages.

## 0.33.0

### Minor Changes

- 7c0a420: Add per-session effort settings for Codex and Claude agent conversations. Persist effort alongside model, expose provider- and model-aware effort selection in the agent session header, coerce invalid effort values when the model changes, and pass the selected effort through the Claude CLI and Codex runtime.

## 0.32.0

### Minor Changes

- 6ed6466: Improve agent session handling in two areas: make Codex user-input requests wait for explicit resolution and map answers back to question IDs correctly, and add a stronger `Needs You` attention model in the sidebar with explicit acknowledge/snooze reminder actions for saved and open conversations.

## 0.31.0

### Minor Changes

- 39f0ebc: Add a GitHub PR hub action to open a conflict-resolution divergence with the PR base branch merged into the checkout so conflicts are materialized locally. Also update the seeded review and conflict-resolution agent prompts to remind agents to install dependencies before running tests or app commands in fresh divergence copies.

## 0.30.1

### Patch Changes

- a9543ad: Pin local development and GitHub workflows to Node 24.14.0, add an `.nvmrc`, and update Actions dependencies to versions that run on the newer Node runtime.

## 0.30.0

### Minor Changes

- aef36b2: Add GitHub PR review divergence creation, improve agent session attention and model configuration, and harden agent runtime handling for provider payloads and Gemini CLI edge cases.

### Patch Changes

- 07927a0: Improve agent conversation tool traces by grouping adjacent tool bursts, preserving clearer command summaries, and making grouped steps easier to scan.
- 25d3562: Add a Codex conversation-context indicator to the agent header and preserve the normalized context snapshot in saved agent sessions.
- 4f483d6: Load lightweight agent session summaries first and lazily hydrate full saved transcripts when a conversation is opened, reducing agent session startup cost for large histories.
- 3538523: Stabilize split-terminal pane identities and tmux session targeting, and preserve plan-ready session attention when agent tabs are hydrated from lightweight summaries.

## 0.29.2

### Patch Changes

- d83381e: Improve agent conversations with provider-gated attachments, refreshed Claude model options, persisted attachment compatibility fixes, and a faster conversation UI with virtualized timelines, debounced draft persistence, sticky follow scroll, and denser runtime activity rows.

## 0.29.1

### Patch Changes

- a3bbf18: Add agent runtime telemetry for slow turns and improve agent conversation naming with automatic titles plus manual rename support.

## 0.29.0

### Minor Changes

- 2f29a63: Add plan mode and image attachments to the agent runtime UI, including staged image transport for Codex, Claude, and Gemini, Shift+Tab mode switching in the composer, and a Cursor streaming fix that prevents duplicated assistant responses.

## 0.28.0

### Minor Changes

- 110d229: Add a local-first multi-provider agent runtime to Divergence with persisted agent sessions, shared React-based agent UI, provider registry support for Codex, Claude, Cursor, and Gemini, workflow integrations for review/PR/automation flows, and runtime hardening for session recovery and provider readiness.

## 0.27.1

### Patch Changes

- bbba2a4: Fix tmux session kill actions so sessions are terminated against the correct tmux server and disappear promptly from the tmux sessions panel.

  Stop auto-reconnecting terminal sessions after intentional clean exits, which prevents killed tmux sessions from immediately respawning.

## 0.27.0

### Minor Changes

- d7c60f1: Remove Claude API usage checks from the Usage Limits feature. The Claude usage endpoint consistently returned 429/rate-limit errors and OAuth scope issues. Only Codex usage tracking remains. The `claudeOAuthToken` setting is unchanged and still used by automations and GitHub PR Hub.

## 0.26.4

### Patch Changes

- 07b7354: Increase terminal split capacity from 3 to 4 panes, including pane-4 support in split session state and tmux session ownership/mapping helpers.

## 0.26.3

### Patch Changes

- e2cdbe4: Refactor: extract hooks from large container components to reduce per-file complexity. App.container.tsx, MainArea.container.tsx, and QuickEditDrawer.container.tsx each had their self-contained concerns extracted into dedicated hook and pure module files. No functional changes.

## 0.26.2

### Patch Changes

- 5f1fcc8: Add a "Talk to your PR" AI sidebar in PR details with local-agent execution, PR-aware context generation, and `Cmd+Enter`/`Ctrl+Enter` send support in the chat composer.

## 0.26.1

### Patch Changes

- efc137b: Add a centralized Pull Requests hub in Work view to review and merge GitHub PRs across configured projects, including PR detail, changed files, diff preview, and merge actions.

## 0.26.0

### Minor Changes

- 2638803: Improve the Linear task sidebar experience in the right panel:

  - stop automatic re-fetching on unrelated terminal/tmux activity
  - load once per context when opening the Linear tab, then require manual refresh
  - add issue status filters with open-state default and optional all-state view
  - add broad issue search (identifier, title, description, assignee, status)
  - add subtle status color coding to improve scanability

## 0.25.0

### Minor Changes

- 7740f2a: Add mobile device integration with WebSocket server and remote access:

  - WebSocket JSON-RPC server with handshake, auth, and heartbeat protocol
  - Pairing code authentication flow with secure token sessions
  - mDNS/Bonjour discovery so mobile devices can find the desktop
  - Remote Access settings panel wired into Settings modal
  - Auto-open Settings to Remote Access tab when a mobile device connects
  - Auto-generate pairing code on mobile handshake event
  - Cloud push notifications for automation completion
  - Connected devices management UI

## 0.24.0

### Minor Changes

- 4d841bb: Add a Linear task queue in the main right panel, including:

  - loading project issues from Linear via `.ralphy/config.json` project mapping
  - sending selected issues to the active terminal as prompt text
  - new `linearApiToken` integration setting
  - improved Linear API error visibility for failed fetches

## 0.23.1

### Patch Changes

- 3269515: Simplify theme configuration in settings by:

  - removing editor theme selection controls from the Appearance section,
  - keeping only app-level Dark/Light mode selection,
  - hardcoding editor themes to Divergence Dark for dark mode and GitHub Light for light mode.

## 0.23.0

### Minor Changes

- 54b1169: Add event-driven cross-project automations triggered by merged GitHub pull requests.
  This includes trigger configuration UI, cloud event polling with ack/nack, deduped
  dispatch tracking, workspace provisioning for source/target projects, and enriched
  automation run context for local Codex/Claude execution.

## 0.22.2

### Patch Changes

- a51368b: Highlight terminal tabs when a background command becomes idle so it is easier to find tabs waiting for user input.

## 0.22.1

### Patch Changes

- aecf84c: Add a settings option to restore terminal tabs after app restart and persist open tabs between launches.

## 0.22.0

### Minor Changes

- d6675b4: Extract 9 shared UI components (ErrorBanner, EmptyState, PanelHeader, SegmentedControl, ProgressBar, LoadingSpinner, ModalHeader, ModalFooter, Kbd) from repeated inline patterns across 25+ files. Consolidate duplicated AutomationCard into the entity layer. Add shadcn/ui foundation with cn utility and base primitives. Fix bg-accent theme bug in ChangesPanel.

## 0.21.1

### Patch Changes

- 69a9192: Migrate UI usage to shared design-system primitives, introduce shared modal/button/form abstractions, and enforce adoption with Chaperone rules.

## 0.21.0

### Minor Changes

- 38a4f41: Add workspace-level port settings, improve port allocation with real availability checks, and wire proxy route lifecycle for divergence cleanup.

## 0.20.0

### Minor Changes

- 5fd4cdb: Add draggable split-pane resizing for terminal sessions in both vertical and horizontal layouts.

## 0.19.0

### Minor Changes

- 2c57eeb: Remap Cmd+[/] shortcuts to cycle focus between split terminal panes instead of switching session tabs

## 0.18.0

### Minor Changes

- a79da80: feat(port-management): automatic port allocation, framework detection, and reverse proxy support for divergences

  Divergences now get automatic dev server port allocation (range 3100-3999) on creation, with framework-specific ENV injection (PORT, DIVERGENCE_PORT, VITE_PORT, etc.) into terminal sessions. Supports Next.js, Vite, CRA, Nuxt, Remix, Astro, Angular, and SvelteKit via an extensible adapter registry. Includes a Caddy reverse proxy API for friendly URLs like `feature-branch.myproject.divergence.localhost`, a port dashboard in the work sidebar, project-level port/framework settings, and a Rust TCP port availability check command.

## 0.17.0

### Minor Changes

- 5d8e076: feat(workspace-divergences): create workspace-level divergences that group per-project divergences

  When creating divergences from a workspace, a workspace divergence folder is now also created with symlinks pointing to the per-project divergence paths instead of the originals. This workspace divergence appears under its parent workspace in the sidebar, can be opened as a terminal session, and is searchable via the quick switcher. Deleting a workspace also cleans up associated workspace divergence folders on disk.

## 0.16.5

### Patch Changes

- d174237: feat(debug): add in-app Debug Console with live terminal/tmux diagnostics, search/filter controls, and failure-focused views for production troubleshooting
- b782696: fix(usage): detect Claude OAuth scope error and show actionable message instead of raw API JSON

## 0.16.4

### Patch Changes

- 541e900: Usage limits now prioritize the Claude OAuth token from Divergence settings and resolve long-lived tokens before falling back to keychain credentials.

## 0.16.3

### Patch Changes

- 2b42752: Colocate pure tests with \*.pure.ts files and enforce sibling pairing via Chaperone.

## 0.16.2

### Patch Changes

- c882266: Restore Claude usage visibility in the Usage Limits popover when Claude credentials are provided via the long-lived `claude setup-token` flow.

  The app now forwards the saved Claude OAuth token to usage status/fetch commands, and the Tauri backend accepts that token (plus `CLAUDE_CODE_OAUTH_TOKEN`) as a valid credential source before falling back to legacy Keychain/file discovery.

  Terminal splitting now supports up to three panes per session. `Cmd+D` adds panes up to the three-pane cap, and `Cmd+W` closes the currently focused split pane before closing the full tab when only one pane remains.

  Terminals now surface startup stalls explicitly instead of appearing silently stuck on a blank screen: each stalled terminal shows an in-pane warning with diagnostics and actions to reconnect that terminal or restart the app.

## 0.16.1

### Patch Changes

- 76886a5: add icon to show token

## 0.16.0

### Minor Changes

- 1be1867: Add Claude OAuth token setting for long-running automations. Store a long-lived token from `claude setup-token` in app settings and inject it as `CLAUDE_CODE_OAUTH_TOKEN` env var into automation tmux sessions. Remove keepalive and auth retry logic from wrapper script in favor of the env-based approach.

## 0.15.8

### Patch Changes

- 06cd011: Fix tmux sessions not appearing in production mode by replacing tab separator with ::: in tmux list-sessions format strings. Add file-based debug logging at ~/Library/Logs/Divergence/tmux-debug.log for production diagnostics.
- 4d8c00a: fix tmux sessions

## 0.15.7

### Patch Changes

- 06cd011: Replace stderr debug logging with file-based logging for tmux diagnostics in production. Logs are written to ~/Library/Logs/Divergence/tmux-debug.log since eprintln output is not visible for Finder-launched GUI apps on macOS.

## 0.15.6

### Patch Changes

- 9a2766e: Fix tmux sessions not appearing in production mode by propagating TMPDIR from login shell to tmux commands. Add comprehensive diagnostics logging and UI panel for debugging tmux environment issues.

## 0.15.5

### Patch Changes

- 266f9c6: Improve architecture and hygiene enforcement across the app and backend.

  - Enforce stricter Chaperone rules for import boundaries and pure-file behavior.
  - Migrate naming/placement to align with FSD conventions (`*.pure.ts`, `*.api.ts`, `*.service.ts`, and shared public API usage).
  - Refactor presentational/container boundaries where needed.
  - Harden Rust backend error handling (remove panic-prone `expect` paths).
  - Improve Rust helper structure and reduce path conversion duplication.
  - Add missing unit-test coverage for quick edit import extension exports.

## 0.15.4

### Patch Changes

- 2c2c893: Terminal resilience and stability improvements: fix theme-change restart, remove dead WebGL toggle and PTY resume calls, add StrictMode double-mount resilience, auto-reconnect on PTY death with exponential backoff, and tmux bootstrap timeout with user feedback.

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
