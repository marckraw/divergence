# Agent Runtime Phase 1 Handoff

## What exists now

- Tauri-side agent runtime is no longer a placeholder registry.
- Agent runtime state is persisted to disk and restored on startup.
- Live session updates are pushed to the renderer through the Tauri event:
  - `agent-runtime-session-updated`
- Real provider-backed turns now run locally for:
  - Claude Code via `claude -p --verbose --output-format stream-json --include-partial-messages`
  - Codex CLI via `codex exec --json` and `codex exec resume --json`
- Frontend has a real `useAgentRuntime` hook that hydrates snapshots, subscribes to live updates, creates sessions, starts turns, stops sessions, and deletes sessions.
- Workspace UI now supports mixed session tabs:
  - terminal sessions
  - agent sessions
- Sidebar project/workspace context menus can open Claude or Codex agent sessions.
- Quick Switcher understands agent sessions.
- Review-agent flow now opens a real agent session instead of injecting a shell command into a terminal tab.

## Important implementation details

- Current provider transport is headless CLI for both providers.
- Codex App Server is still the intended long-term target for Codex, but the current implementation uses `codex exec --json` because it gives a working structured local path with session resume today.
- Agent session close semantics are split:
  - `stop_agent_session` marks runtime state as stopped
  - `delete_agent_session` removes the session from persistence and UI
- The main workspace still keeps terminal internals separate. Agent sessions are integrated at the app shell / navigation layer, not by forcing agent output through the PTY path.
- Agent UI currently renders:
  - transcript messages
  - activity list
  - runtime state
  - error state
  - prompt composer
- Agent UI does not yet render formal approval cards or structured request-response flows.

## Files/slices added or materially changed

- `src-tauri/src/agent_runtime/mod.rs`
- `src-tauri/src/commands.rs`
- `src-tauri/src/lib.rs`
- `src/shared/api/agentRuntime.api.ts`
- `src/shared/api/agentRuntime.types.ts`
- `src/features/agent-runtime/`
- `src/widgets/agent-session-view/`
- `src/widgets/workspace-session-tabs/`
- `src/app/App.container.tsx`
- `src/app/model/useReviewAgentSession.ts`
- `src/widgets/sidebar/ui/Sidebar.presentational.tsx`
- `src/features/quick-switcher/`
- `src/entities/workspace-session/`

## Invariants

- Terminal sessions remain the only PTY-backed session type.
- Shared UI state consumes normalized agent snapshots, not raw terminal output.
- Provider-specific parsing stays in the Tauri agent runtime layer.
- Agent sessions are local-first and depend on the user’s installed/logged-in CLI tools.

## Known limitations / open risks

- PR Hub is still on the old one-shot hidden command path and has not been migrated to the shared runtime yet.
- Automations/task-center have not been converged onto the runtime event model yet.
- Approval / `AskUserQuestion` / permission request handling is not implemented as structured UI yet.
- `stop_agent_session` does not yet kill a running provider process; it only updates persisted runtime state.
- Codex transport is CLI JSON for now, not App Server.

## Validation status

- `npm install`
- `npm run typecheck`
- `npm run test:pure`
- `npm run test:unit`
- `chaperone check --fix`
- `cargo clippy -- -D warnings`

All passed at the end of this phase.

## Next phase

1. Migrate PR Hub from one-shot hidden execution to shared runtime turns.
2. Add structured request/approval handling to the agent UI.
3. Decide whether Codex should remain on CLI JSON for v1 or move to App Server immediately.
4. Converge automations and task-center state onto shared agent activity concepts.
