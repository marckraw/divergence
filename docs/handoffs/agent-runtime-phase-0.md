# Agent Runtime Phase 0 Handoff

## What exists now

- Architecture document for the local-first agent runtime.
- Shared frontend agent-session and workspace-session types.
- Tauri-side placeholder agent runtime registry and command surface.
- Shared frontend API wrappers for querying runtime capabilities and placeholder sessions.

## Invariants

- Terminal sessions remain the only session type used by the main workspace UI today.
- Agent runtime code is foundational only; it does not yet execute Claude or Codex.
- The new runtime command surface is safe to extend without breaking existing workflows.

## Open risks

- App-level session orchestration still assumes terminal-only session maps.
- Agent runtime state is in-memory only in this phase.
- No provider adapter is connected yet.

## Next phase

- Introduce workspace-session-aware persistence and app state.
- Add Claude adapter scaffolding and runtime event normalization.
