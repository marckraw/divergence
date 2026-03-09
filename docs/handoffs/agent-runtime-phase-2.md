# Agent Runtime Phase 2 Handoff

## What exists now

- Codex runtime no longer uses `codex exec --json`.
- Divergence now runs Codex through `codex app-server` over JSON-RPC on stdio.
- Tauri-side agent runtime tracks live child processes so `stop_agent_session` is an actual process stop, not just a snapshot mutation.
- Agent sessions can now surface structured pending requests:
  - approval requests
  - user-input requests
- React agent tabs render those pending requests inline and can answer them back into the runtime.
- Automation runs now launch through the shared agent runtime instead of the tmux wrapper path.
- Task Center can reopen automation runs as agent sessions when the run is agent-backed.
- Automation restart reconciliation and pollers understand both:
  - legacy tmux-backed runs
  - new agent-runtime-backed runs

## Important implementation details

- Claude remains on local `claude -p` streaming and still runs in permissive non-interactive mode.
- Codex uses `codex app-server` per active turn, does initialize/thread start or resume/turn start, then tears down the app-server process after the turn completes or is stopped.
- Codex structured requests are mapped into persisted `pendingRequest` state with:
  - approval options
  - user-input questions/options
- `respond_agent_request` is the Tauri command that resolves those pending runtime requests.
- Agent session persistence is still snapshot-based. If Divergence restarts while a provider process is mid-turn, the persisted session is normalized back to `stopped` on load.
- Automation runs now persist agent linkage in `automation_runs.details_json`:
  - `runtime: "agent"`
  - `agentSessionId`
  - `provider`

## Files/slices added or materially changed

- `src-tauri/src/agent_runtime/mod.rs`
- `src-tauri/src/commands.rs`
- `src-tauri/src/lib.rs`
- `src/shared/api/agentRuntime.api.ts`
- `src/shared/api/agentRuntime.types.ts`
- `src/shared/index.ts`
- `src/features/agent-runtime/model/useAgentRuntime.ts`
- `src/widgets/agent-session-view/`
- `src/features/automations/service/runAutomationNow.service.ts`
- `src/features/automations/model/useAutomationRunPoller.ts`
- `src/features/automations/service/reconcileAutomationRuns.service.ts`
- `src/entities/task/model/task.types.ts`
- `src/entities/task/lib/taskCenter.pure.ts`
- `src/features/task-center/ui/TaskCenterPage.presentational.tsx`
- `src/app/model/useTaskCenterAttachment.ts`
- `src/app/model/useAutomationOrchestration.ts`
- `src/app/App.container.tsx`

## Invariants

- Terminals remain PTY-backed and separate from provider-backed agent sessions.
- Shared React state still consumes normalized snapshots, not raw provider protocol messages.
- Codex provider-specific parsing is contained in the Tauri runtime layer.
- Automation UX now reuses the same session model as interactive agent tabs.

## Known limitations / open risks

- Claude still does not expose structured approval/user-input requests in the current implementation.
- Codex App Server currently runs one process per active turn instead of keeping a long-lived provider session alive across turns.
- Automation agent runs are persisted and reopenable, but autonomous runs are not yet auto-cleaned up into a hidden/archive-only session state.
- There is still no full event-sourced history model; state restoration is snapshot-based.

## Validation status

- `npm run typecheck`
- `cargo clippy -- -D warnings`

Both passed after this phase. Full project validation should still be rerun before closing the wider task.

## Next phase

1. Run the full Divergence validation suite.
2. Decide whether Claude should stay permissive/headless for v1 or get a structured permission bridge.
3. If needed, optimize Codex App Server from per-turn lifecycle to long-lived session lifecycle.
