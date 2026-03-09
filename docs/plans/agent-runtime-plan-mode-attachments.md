# Agent Runtime Plan Mode and Attachments

## Goal

Add two shared agent-runtime capabilities to Divergence without falling back to terminal emulation:

- per-turn plan mode
- image attachments in the agent composer

The implementation remains local-first and adapter-driven:

`composer state -> staged attachment runtime -> provider adapter -> structured session snapshot -> React projection`

## Provider truth

- Codex
  - plan mode: App Server collaboration mode on `turn/start`
  - structured requests: yes
  - image attachments: yes, sent as multimodal input items with data URLs
- Claude
  - plan mode: `--permission-mode plan`
  - structured requests: no public structured request surface in the current headless path
  - image attachments: yes, staged locally and referenced in prompt text
- Cursor
  - plan mode: `--mode plan`
  - structured requests: no
  - image attachments: intentionally unsupported for now
- Gemini
  - plan mode: `--approval-mode plan`
  - structured requests: no
  - image attachments: yes, staged locally and referenced through `@/path` prompt syntax

## Core design choices

- Plan mode is a per-turn composer option, not a special session type.
- Image attachments are staged under the runtime attachment directory and passed to adapters from stable ids.
- Unsupported features stay visible but disabled in the UI when that clarifies provider differences.
- Codex remains the richest structured provider; other providers treat plan follow-up questions as assistant messages in v1.

## Implementation checklist

1. Extend shared TypeScript and Rust runtime contracts for interaction mode and attachments.
2. Add runtime attachment staging and discard commands.
3. Thread interaction mode and attachments through all provider adapters.
4. Add plan/image capability flags to provider descriptors.
5. Upgrade the agent composer UI for:
   - Chat / Plan toggle
   - image picker
   - paste support
   - drag-and-drop
   - attachment chips
   - unsupported-capability messaging
6. Render plan and attachment context back into the conversation timeline.
7. Validate with:
   - `npm run typecheck`
   - `npm run test:pure`
   - `npm run test:unit`
   - `chaperone check --fix`
   - `cargo clippy -- -D warnings`

## Recovery protocol

At the start of any follow-up session, reread:

- `docs/architecture/agent-runtime.md`
- this plan doc
- the latest `docs/handoffs/agent-runtime-plan-mode-phase-*.md`

The handoff must be treated as the current truth before new edits start.
