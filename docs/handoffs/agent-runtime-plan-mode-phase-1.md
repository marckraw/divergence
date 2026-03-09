# Agent Runtime Plan Mode and Attachments: Phase 1 Handoff

## What exists now

- Shared runtime contracts now include per-turn `interactionMode` and message-level attachment metadata.
- Provider descriptors expose `planMode`, `attachmentKinds`, and `structuredPlanUi`.
- Divergence can stage supported attachments through the Tauri runtime and discard them before send.
- The agent composer now supports:
  - Chat / Plan mode toggle
  - provider-gated attachment picker
  - draft-local hover previews for image chips
  - image paste from clipboard
  - attachment drag-and-drop
  - per-session draft state across agent-tab switches
- User messages in the timeline now show:
  - plan-mode badge when applicable
  - attachment chips

## Provider behavior verified in code

- Codex
  - App Server turns now send collaboration mode metadata for plan/default turns.
  - Image attachments are converted into `data:` URLs and added as multimodal `input` items.
  - PDF attachments are rejected in the runtime.
- Claude
  - Plan turns use `--permission-mode plan`.
  - Image attachments are staged, added as allowed directories, and referenced in the composed prompt text.
  - PDF attachments are rejected in the runtime.
- Cursor
  - Plan turns use `--mode plan`.
  - All attachments are explicitly rejected in the runtime and disabled in the UI.
- Gemini
  - Plan turns use `--approval-mode plan`.
  - Image and PDF attachments are staged, included as allowed directories, and injected into the prompt with `@/path`.

## Important files changed

- `src/shared/api/agentRuntime.types.ts`
- `src/shared/api/agentRuntime.api.ts`
- `src/shared/lib/agentProviders.pure.ts`
- `src/features/agent-runtime/model/useAgentRuntime.ts`
- `src/widgets/agent-session-view/ui/AgentSessionView.types.ts`
- `src/widgets/agent-session-view/ui/AgentSessionView.container.tsx`
- `src/widgets/agent-session-view/ui/AgentSessionView.presentational.tsx`
- `src-tauri/src/agent_runtime/mod.rs`
- `src-tauri/src/agent_runtime/claude.rs`
- `src-tauri/src/agent_runtime/codex.rs`
- `src-tauri/src/agent_runtime/cursor.rs`
- `src-tauri/src/agent_runtime/gemini.rs`
- `src-tauri/src/agent_runtime/provider_registry.rs`
- `src-tauri/src/commands.rs`
- `src-tauri/src/lib.rs`

## What is intentionally deferred

- Session-restart recovery for composer drafts. Drafts currently survive agent-tab switches in the running app session.
- Rich preview rendering in the conversation timeline. The current UI limits preview to draft chips before send.
- Structured plan rendering outside Codex. Claude, Cursor, and Gemini plan output remains assistant-message based.

## Validation status

- `npm run typecheck`
- `cargo clippy -- -D warnings`

Both pass after the phase-1 implementation. Full repo validation still needs to be rerun after the final edits in this workstream.

## Next step

Run the full Divergence validation gate:

- `npm install`
- `npm run test:pure`
- `npm run test:unit`
- `chaperone check --fix`
- `cargo clippy -- -D warnings`
