# Agent Runtime Architecture

## Goal

Add a local-first agent runtime to Divergence that supports multiple official agent CLIs without replacing the existing terminal workflow.

The runtime shape is:

`provider process -> provider adapter -> canonical runtime events -> persisted agent session snapshot -> React projections`

## Core decisions

- Terminals remain first-class and unchanged for human shell workflows.
- Agent sessions are a distinct domain model from terminal sessions.
- Provider support is registry-driven, not hardcoded per screen.
- Plan mode is a per-turn composer option, not a separate session type.
- Image attachments are staged by the runtime and passed through provider adapters instead of terminal paste shortcuts.
- Claude uses a local CLI adapter.
- Codex uses a dedicated App Server adapter.
- Cursor uses a local headless CLI adapter.
- Gemini uses a local headless CLI adapter with `stream-json` when the installed CLI supports it, and falls back to text-first capture otherwise.
- v1 persists agent session snapshots and replayable UI state, but does not implement full event sourcing.

## Session taxonomy

- `TerminalSession`: tmux/shell-backed session used for raw terminal work.
- `AgentSession`: provider-backed interactive session rendered as structured UI.
- `WorkspaceSession`: union of terminal and agent sessions used by navigation and persistence boundaries.

## Canonical runtime contract

The runtime must normalize provider-specific behavior into these events:

- `session.started`
- `session.resumed`
- `session.stopped`
- `turn.started`
- `content.delta`
- `content.completed`
- `activity.started`
- `activity.updated`
- `activity.completed`
- `request.opened`
- `request.resolved`
- `turn.completed`
- `runtime.error`

Provider adapters may emit richer internal events, but only the canonical contract is allowed to cross into shared UI state.

## Backend responsibilities

- Own provider process lifecycle.
- Own session registry and snapshot state.
- Normalize provider output into canonical runtime events.
- Expose Tauri commands for session lifecycle and event subscription.
- Persist agent session snapshots.
- Cache provider capability/readiness probes and refresh them explicitly instead of shelling out on every UI read.

## Provider notes

- Claude runs through local `claude -p` streaming and still uses permissive headless execution rather than surfaced approval requests.
- Claude plan turns use `--permission-mode plan`.
- Claude image attachments are staged locally, added as allowed directories, and referenced in the prompt wrapper by file path.
- Claude PDF attachments remain disabled in Divergence.
- Codex runs through `codex app-server` over JSON-RPC on stdio and surfaces structured approval/user-input requests into the React UI.
- Codex plan turns use App Server collaboration mode metadata.
- Codex image attachments are converted into `data:` URLs and sent as multimodal `turn/start` input items.
- Codex PDF attachments remain disabled because the current App Server transport is image-only.
- Cursor runs through local `cursor-agent --print --output-format stream-json` and reuses the provider session id as the shared `threadId`.
- Cursor plan turns use `--mode plan`.
- Cursor attachments remain intentionally disabled until the official headless CLI exposes a stable attachment transport.
- Gemini runs through local `gemini -p` and now uses `--output-format stream-json` on binaries that advertise it, with text fallback only for older installs.
- Gemini plan turns use `--approval-mode plan`.
- Gemini image and PDF attachments are staged locally, added to the included directories, and injected into the prompt as `@/absolute/path` references.
- Automation runs use the same agent runtime and store their linked `agentSessionId` in automation run metadata so Task Center and restart reconciliation can attach back to the same structured session.
- Provider auth stays inside the official CLI process. Divergence never extracts subscription credentials for direct backend calls.
- Database migration recovery is part of startup. Divergence repairs the known half-applied `automations_v13` migration state before normal data loading continues.
- Provider-specific runtime code is split into dedicated Rust modules:
  - `claude.rs`
  - `codex.rs`
  - `cursor.rs`
  - `gemini.rs`
  - `opencode.rs`
  - `provider_registry.rs`
  - `skills.rs`
- `mod.rs` is the agent-runtime facade/module entrypoint and should stay focused on module declarations, re-exports, and small glue where practical.
- Shared runtime logic should move toward focused backend modules such as state, persistence, attachments, requests, events, and message/activity helpers instead of accumulating in `mod.rs`.

## Frontend responsibilities

- Store and render agent session snapshots.
- Route user input and approval responses back to the runtime.
- Project canonical events into chat, work log, and request UI.
- Preserve per-session composer draft state, including plan mode and staged attachment metadata, across agent-tab switches.
- Keep attachment previews draft-local in the renderer; preview URLs are never persisted into the runtime snapshot.
- Keep terminal-specific rendering isolated from agent-specific rendering.

## Enforcement

- Chaperone blocks hardcoded legacy capability fields and warns on reintroducing hardcoded provider selectors.
- Chaperone warns on hardcoded provider defaults so feature state does not drift away from shared provider helpers.
- Shared provider metadata lives in one registry shape across Rust and TypeScript.
- New provider additions must update the provider registry, readiness metadata, and pure provider helper tests together.

## Invariants

- No agent UI code may depend on terminal PTY output.
- No provider-specific event shape may leak into shared React state.
- Existing terminal session behavior must remain unchanged while the runtime is introduced.
- New provider UIs must read from shared provider metadata instead of hardcoded `claude` / `codex` lists.
