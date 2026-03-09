# Agent Runtime Phase 3 Handoff

## What exists now

- The agent runtime no longer treats providers as a hardcoded `claude|codex` pair in frontend shared state.
- Divergence now exposes a provider registry shape through `AgentRuntimeCapabilities.providers`.
- Cursor and Gemini are added as first-class provider ids across the TypeScript session/runtime model.
- Settings now render provider runtime readiness cards so teammates can see install/auth/setup state before opening sessions.
- Cursor CLI and Gemini CLI adapters exist in the Tauri runtime:
  - Cursor uses headless print mode with stream-json intent.
  - Gemini uses headless prompt mode with stream-json on supported binaries and text fallback otherwise.
- Sidebar, automations, diff review, and PR chat selectors now render from shared provider metadata instead of hardcoded provider options.
- Chaperone now warns on reintroducing hardcoded `claude|codex` provider unions/selectors and errors on reintroducing legacy runtime capability fields.
- Provider capability probing is cached in the Tauri runtime and refreshed explicitly, so UI reads no longer fan out into repeated CLI readiness/model checks.
- The Rust runtime is now split into provider-oriented modules instead of one monolithic implementation file.

## Important implementation details

- Shared frontend provider metadata lives in `src/shared/lib/agentProviders.pure.ts`.
- Rust capability output is still produced by the agent runtime core, but provider-specific behavior is split across:
  - `src-tauri/src/agent_runtime/provider_registry.rs`
  - `src-tauri/src/agent_runtime/claude.rs`
  - `src-tauri/src/agent_runtime/codex.rs`
  - `src-tauri/src/agent_runtime/cursor.rs`
  - `src-tauri/src/agent_runtime/gemini.rs`
  The runtime still returns provider descriptors with:
  - transport
  - default model
  - model options
  - readiness
  - feature flags
- Claude remains permissive/headless.
- Codex remains the richest provider:
  - App Server transport
  - structured requests
  - usage inspection
- Cursor currently depends on the local `cursor-agent` binary and uses `whoami` for readiness/auth detection.
- Cursor now uses the authenticated local model catalog from `cursor-agent models` when available, so model choices come from the real account instead of a static list.
- Gemini currently depends on the local `gemini` binary and uses stream-json when the installed CLI advertises it.
- Automation schema now allows `cursor` and `gemini` as persisted agent values. Existing databases migrate by recreating the `automations` table with the wider enum/check constraint.
- Migration startup now repairs the known half-applied v13 state where `automations` was dropped and only `automations_v13` remained.
- Shared provider defaults now come from `getDefaultAgentProvider()` / `DEFAULT_AGENT_PROVIDER`, and Chaperone enforces that new feature defaults do not drift back to string literals.

## Invariants

- Provider credentials stay inside the official CLI process.
- UI provider lists must come from shared provider metadata, not handwritten option lists.
- Terminal/tmux workflows remain separate from provider-backed agent sessions.
- Shared React state still stores normalized snapshots, not raw provider protocol payloads.

## Known limitations / open risks

- Cursor runtime parsing is improved against authenticated local output, but still needs broader real-world coverage for more complex tool-heavy turns.
- Gemini structured streaming now works on the currently installed CLI, but older installs may still fall back to text-first handling.
- Settings readiness is intentionally advisory for some providers:
  - Codex can confirm login
  - Cursor can partially confirm auth
  - Claude and Gemini remain partly heuristic today

## Validation status

- `npm install`
- `npm run typecheck`
- `npm run test:pure`
- `npm run test:unit`
- `chaperone check --fix`
- `cargo clippy -- -D warnings`

All passed for the completed phase.

## Next phase

1. Run full project validation (`npm install`, `npm run test:pure`, `npm run test:unit`, `chaperone check --fix`, `cargo clippy -- -D warnings`).
2. Keep exercising Cursor and Gemini on real, tool-heavy sessions and extend parsers only when the official CLI surfaces prove the new event types are stable.
3. Consider whether provider metadata duplication between Rust and TypeScript should collapse into a single generated source of truth, or remain split intentionally.
