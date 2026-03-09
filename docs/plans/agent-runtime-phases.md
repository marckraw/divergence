# Agent Runtime Phases

## Phase 0

- Write ADR-level architecture document.
- Define shared frontend types for agent sessions and canonical runtime data.
- Add backend placeholder runtime registry and command surface.
- Add a handoff document for the implemented foundation.

## Phase 1

- Add session persistence for agent snapshots.
- Add app-level workspace-session union handling.
- Add agent runtime API wrappers and debug introspection tools.

## Phase 2

- Implement Claude CLI adapter.
- Stream normalized runtime events into React.
- Add reconnect-safe agent session restoration.

## Phase 3

- Add first-class agent tabs in the main area.
- Render messages, activity log, and pending request cards.
- Generalize prompt routing from terminal-only to session-aware.

## Phase 4

- Migrate PR Hub onto the shared runtime.
- Migrate review-agent flows off shell-command injection.

## Phase 5

- Implement Codex App Server adapter.
- Run both providers through the same canonical event contract.

## Phase 6

- Converge automations and task-center state onto shared activity concepts.
- Harden restart, timeout, cancellation, and auth-expiry behavior.

## Phase 7

- Replace hardcoded provider capabilities with a provider registry model.
- Add provider readiness metadata and settings-provider cards.
- Add Chaperone enforcement for provider-registry boundaries.

## Phase 8

- Add Cursor CLI adapter and wire Cursor into shared selectors, sessions, and automations.
- Add Gemini CLI adapter and wire Gemini into shared selectors, sessions, and automations.
