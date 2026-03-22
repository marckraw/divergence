# Agent Session Ergonomics Port Plan

Status: Proposed
Owner: Core team
Created: 2026-03-20

## Goal

Port the highest-value agent-thread ergonomics from `t3code` into Divergence without importing `t3code`'s orchestration architecture.

The three target behaviors are:

1. First-class proposed-plan objects with lifecycle, not just a "latest assistant plan-mode message" heuristic.
2. Terminal selection to agent-context handoff.
3. Provider-specific composer traits for provider/model-backed turn settings.

## Non-goals

1. Do not port `t3code`'s Claude SDK integration or any subscription-risky auth path.
2. Do not rewrite Divergence's Rust runtime into a Node/Effect orchestration layer.
3. Do not port `t3code`'s full rich-text composer or Lexical editor stack.
4. Do not redesign the overall app shell or make terminal and agent sessions render simultaneously.

## Product reading

Divergence is already stronger as a local workbench and provider runtime. The missing piece is agent-thread ergonomics.

The relevant existing Divergence constraints are:

- Agent session persistence is snapshot-based JSON in the Rust runtime, not an event-sourced projection pipeline.
- The app shows either `MainArea` for terminal sessions or `AgentSessionView` for agent sessions in the active work area.
- Agent composer draft state already persists in `sessionStorage`, but only for `text`, `interactionMode`, and `attachments`.
- Provider capability flags already expose `structuredPlanUi` and `providerExtras`, but the UI largely stops at model and effort.

The port should copy product behavior and fit it into Divergence's current architecture:

`provider process -> provider adapter -> agent session snapshot -> React projections`

## Reference files

### Divergence

- `docs/architecture/agent-runtime.md`
- `src-tauri/src/agent_runtime/mod.rs`
- `src-tauri/src/agent_runtime/provider_registry.rs`
- `src/shared/api/agentRuntime.types.ts`
- `src/shared/api/agentRuntime.schemas.ts`
- `src/shared/api/agentRuntime.api.ts`
- `src/features/agent-runtime/lib/agentRuntimeSnapshot.pure.ts`
- `src/features/agent-runtime/model/agentRuntimeStore.ts`
- `src/features/agent-runtime/model/useAgentRuntime.ts`
- `src/entities/agent-session/model/agentSession.types.ts`
- `src/entities/agent-session/lib/agentSessionSettings.pure.ts`
- `src/entities/workspace-session/lib/workspaceSessionAttention.pure.ts`
- `src/widgets/agent-session-view/ui/AgentSessionView.types.ts`
- `src/widgets/agent-session-view/ui/AgentSessionView.container.tsx`
- `src/widgets/agent-session-view/ui/AgentSessionHeader.container.tsx`
- `src/widgets/agent-session-view/ui/AgentSessionTimeline.container.tsx`
- `src/widgets/agent-session-view/ui/AgentSessionComposer.container.tsx`
- `src/widgets/main-area/ui/MainArea.container.tsx`
- `src/widgets/main-area/ui/Terminal.container.tsx`
- `src/app/App.container.tsx`

### t3code behavior references

- `apps/web/src/components/chat/ProposedPlanCard.tsx`
- `apps/web/src/proposedPlan.ts`
- `apps/server/src/orchestration/Layers/ProviderRuntimeIngestion.ts`
- `apps/web/src/lib/terminalContext.ts`
- `apps/web/src/components/ThreadTerminalDrawer.tsx`
- `apps/web/src/components/chat/CodexTraitsPicker.tsx`
- `apps/web/src/components/chat/ClaudeTraitsPicker.tsx`

## Current-state gaps

### Proposed plans

Current Divergence "plan ready" is derived from `latestAssistantMessageInteractionMode === "plan"` and a completed assistant message. That logic lives in `src/entities/workspace-session/lib/workspaceSessionAttention.pure.ts`.

This is too weak because:

1. It treats plan readiness as a transient message fact, not a durable object.
2. There is no place to store plan markdown lifecycle or follow-up state.
3. There is no lineage for "this execution turn implements that plan."
4. The timeline cannot render plan UI separately from a normal assistant message.

### Terminal to agent handoff

Divergence has no bridge between terminal selection and an agent composer. More importantly, the active workspace renders either terminal or agent UI, so a terminal-selection flow cannot assume an agent composer is already visible.

### Provider traits

Capability flags expose `providerExtras`, but the runtime contracts and composer draft do not carry provider-specific per-turn settings. The only persisted controls today are model and effort, mostly at session-header level.

## Design principles

1. Favor Divergence-native extensions over architecture imports from `t3code`.
2. Prefer snapshot-local state over introducing a full projection/event model.
3. Keep new per-turn settings draft-local unless they must survive independently of the draft.
4. Ship provider traits only for settings the current runtime can actually honor.
5. Use generic seams in shared contracts so provider-specific UI does not leak ad hoc flags everywhere.

## Track 1: First-class proposed-plan objects

### Desired behavior

When a plan-mode turn completes, Divergence should store a first-class proposed plan object instead of relying on the latest assistant message only.

The user should be able to:

1. See the latest actionable plan as a distinct card in the timeline.
2. Copy or save the plan markdown.
3. Start an execution follow-up from that plan.
4. Keep plan readiness/attention even after later activity, until the plan is explicitly implemented or dismissed.

### Divergence-native implementation shape

Do not copy `t3code`'s cross-thread projection pipeline.

Instead, add plan objects directly to the persisted `AgentSessionSnapshot` and summary model.

Recommended new types:

```ts
interface AgentProposedPlan {
  id: string;
  sourceMessageId: string | null;
  sourceTurnInteractionMode: "plan";
  title?: string | null;
  planMarkdown: string;
  status: "proposed" | "implemented" | "dismissed";
  createdAtMs: number;
  updatedAtMs: number;
  implementedAtMs?: number | null;
  implementationSessionId?: string | null;
}
```

Add to:

- Rust snapshot structs in `src-tauri/src/agent_runtime/mod.rs`
- shared API types in `src/shared/api/agentRuntime.types.ts`
- Zod schemas in `src/shared/api/agentRuntime.schemas.ts`
- mapped entity model in `src/entities/agent-session/model/agentSession.types.ts`
- frontend snapshot mapping in `src/features/agent-runtime/lib/agentRuntimeSnapshot.pure.ts`

### Capture rules

Phase 1 should use a provider-agnostic capture rule:

1. If a turn was sent with `interactionMode === "plan"`,
2. and the assistant completed successfully,
3. and the final assistant message has non-empty markdown,
4. then upsert a proposed plan object from that assistant message content.

This should be implemented in the Rust runtime where turn completion is already normalized.

Recommended initial hook points:

- `start_turn` and turn bookkeeping in `src-tauri/src/agent_runtime/mod.rs`
- provider completion paths in:
  - `src-tauri/src/agent_runtime/codex.rs`
  - `src-tauri/src/agent_runtime/claude.rs`
  - `src-tauri/src/agent_runtime/cursor.rs`
  - `src-tauri/src/agent_runtime/gemini.rs`

Phase 2 can add provider-specific structured capture where available, but Phase 1 must not wait on that.

### Follow-up lineage

Add a plan reference to turn start input so a default execution turn can declare which plan it is implementing.

Recommended shared input addition:

```ts
interface StartAgentTurnInput {
  ...
  sourceProposedPlanId?: string;
}
```

Recommended runtime behavior:

1. A plan remains `proposed` until an execution turn is actually accepted and started.
2. When a non-plan turn starts with `sourceProposedPlanId`, mark that plan `implemented`.
3. Store `implementationSessionId = current session id`.
4. Use this same linkage later if Divergence adds "implement in new session."

This is simpler than `t3code`'s `implementationThreadId`, but it preserves the useful lineage.

### UI changes

Add plan-aware rendering to `AgentSessionTimeline.container.tsx` instead of showing only a normal assistant bubble.

Recommended UI pieces:

1. `AgentProposedPlanCard.presentational.tsx`
2. pure helpers in `src/widgets/agent-session-view/lib/agentProposedPlan.pure.ts`

Plan card actions:

1. Copy markdown
2. Save to workspace
3. Queue "Implement plan" into the composer

The card should collapse large plans by default. Copy the behavior pattern from `t3code`'s `ProposedPlanCard`, not the exact component structure.

### Attention-state update

Replace the current heuristic in `workspaceSessionAttention.pure.ts`.

New `plan-ready` should mean:

1. there is at least one `proposed` plan in the session,
2. there is no open pending request blocking attention,
3. the session is not currently running.

Do not derive `plan-ready` from latest assistant interaction mode once plan objects exist.

### Persistence

Because Divergence persists session snapshots as JSON, this feature does not require a relational migration.

Required persistence work:

1. extend `AgentSessionSnapshot` serde structs
2. extend `normalize_persisted_session`
3. keep backward compatibility with `#[serde(default)]`

### Acceptance criteria

1. Completing a plan turn creates a durable proposed-plan object.
2. Reopening Divergence preserves proposed plans from persisted snapshots.
3. The sidebar attention badge stays `Plan` until the plan is implemented or dismissed.
4. Starting an execution turn from a plan marks that plan implemented.
5. Normal assistant messages keep working without plan UI regressions.

## Track 2: Terminal selection to agent context

### Desired behavior

From a terminal session, the user can select terminal output and send it into an agent composer as structured context.

Because Divergence only shows one active work area at a time, the handoff must target an agent session explicitly.

### Divergence-native implementation shape

Do not port `t3code`'s full inline Lexical terminal-chip editor.

Use the current textarea composer and draft persistence:

1. terminal selection creates a `TerminalContextSelection`
2. the selection is added to an agent session draft as a pending context chip
3. on send, Divergence appends a structured terminal-context block to the prompt text
4. the raw context stays draft-local and is not persisted into the runtime snapshot unless the user actually sends it

Recommended new draft type:

```ts
interface AgentSessionTerminalContext {
  id: string;
  sourceSessionId: string;
  sourceSessionName: string;
  lineStart: number;
  lineEnd: number;
  text: string;
  createdAtMs: number;
}
```

Add it to `AgentSessionComposerDraft` in `src/widgets/agent-session-view/ui/AgentSessionView.types.ts`.

### Prompt materialization

Borrow `t3code`'s block format idea from `apps/web/src/lib/terminalContext.ts`, but keep it simple.

Recommended send-time format:

```txt
<terminal_context>
- terminal-name lines 120-133:
  120 | npm run build
  121 | ...
</terminal_context>
```

Add pure helpers under:

- `src/widgets/agent-session-view/lib/terminalContext.pure.ts`

Responsibilities:

1. normalize selection text
2. build line-range labels
3. append the terminal-context block to prompt text
4. strip empty or expired contexts

### Terminal-side UX

Add a selection action in `src/widgets/main-area/ui/Terminal.container.tsx`.

Behavior:

1. user selects text in xterm
2. a small action affordance appears near the selection
3. primary action is `Send To Agent`

Selection metadata should include:

1. source terminal session id
2. source terminal session name
3. start and end line numbers if xterm selection position is available
4. normalized selected text

`t3code`'s `ThreadTerminalDrawer.tsx` is the reference behavior for the selection affordance and delayed multi-click handling.

### App-level routing

This is the key Divergence-specific difference from `t3code`.

`App.container.tsx` renders either `MainArea` or `AgentSessionView`, so terminal selection must route across sessions.

Add a new app-level flow:

1. terminal selection emits `onAddTerminalContextRequest`
2. `App.container.tsx` resolves target agent sessions in the same project/workspace
3. if exactly one suitable agent session exists, inject the context and switch to that agent session
4. if multiple suitable agent sessions exist, show a lightweight picker
5. if no suitable agent session exists, offer to create a new agent session and seed its draft

Files to touch:

- `src/widgets/main-area/ui/Terminal.container.tsx`
- `src/widgets/main-area/ui/MainArea.container.tsx`
- `src/app/App.container.tsx`
- `src/widgets/agent-session-view/ui/AgentSessionView.container.tsx`
- `src/widgets/agent-session-view/ui/AgentSessionComposer.container.tsx`

### Composer-side UX

Add terminal-context chips above the textarea in `AgentSessionComposer.container.tsx`.

Each chip should show:

1. terminal/session label
2. line range
3. remove action

The composer draft should persist these chips in `sessionStorage`, just like text and attachments.

Do not add inline cursor-position chips or rich-text placeholder nodes in Phase 1.

### Injection mechanism

Expose an imperative composer draft hook in the agent session view.

Recommended shape:

```ts
interface AgentSessionComposerHandle {
  setText(text: string): void;
  addTerminalContext(context: AgentSessionTerminalContext): void;
}
```

This keeps the current local draft ownership inside `AgentSessionComposer.container.tsx` and avoids lifting the entire draft to higher layers.

### Acceptance criteria

1. Selecting text in a terminal shows a send-to-agent action.
2. The user can target an existing or new agent session.
3. The selected context appears as chips in the target agent composer draft.
4. Sending the prompt appends a structured terminal-context block.
5. Switching away and back preserves unsent terminal-context chips in session storage.

## Track 3: Provider-specific composer traits

### Desired behavior

Expose provider/model-backed per-turn settings near the composer, using a generic traits menu instead of piling all controls into the session header.

This should copy the product pattern from `t3code`'s trait pickers, not its full data model.

### Important constraint

Divergence does not currently have runtime/shared support for per-turn provider settings beyond:

1. interaction mode
2. attachments
3. session-level model
4. session-level effort

So this track must start by adding provider-trait inputs to the draft and start-turn contracts.

### Contract shape

Add a shared draft-local traits object that is provider keyed.

Recommended direction:

```ts
interface AgentRuntimeProviderTurnOptions {
  codex?: {
    fastMode?: boolean;
  };
  claude?: {};
  cursor?: {};
  gemini?: {};
}
```

Add it to:

- `AgentSessionComposerDraft`
- `StartAgentTurnInput`
- `shared/api/agentRuntime.types.ts`
- `shared/api/agentRuntime.schemas.ts`
- `shared/api/agentRuntime.api.ts`
- `features/agent-runtime/model/useAgentRuntime.ts`
- `src-tauri/src/agent_runtime/mod.rs`

### Shipping scope

Phase 1 should only expose traits that the Divergence runtime can actually honor.

Recommended scope:

1. Codex-first composer traits.
2. Keep Claude traits out until the existing CLI path gains stable, supported extra controls beyond model and effort.
3. Keep Cursor and Gemini hidden until there is a real runtime parameter to map them to.

This means the feature architecture is generic, but the first shipped control may only be Codex.

### UI placement

Add a compact traits trigger next to the composer controls, not in the session header.

Recommended file additions:

- `src/widgets/agent-session-view/ui/AgentProviderTraitsMenu.container.tsx`
- `src/widgets/agent-session-view/lib/agentProviderTraits.pure.ts`

Behavior:

1. show only when the active provider has actual shippable traits
2. derive options from provider and model
3. persist selections in the composer draft
4. clear unsupported selections when the model/provider changes

### Header cleanup

Leave session-header model and effort controls in place for now.

If a trait duplicates an existing header control, do not create two competing sources of truth. Phase 1 should not move model or effort ownership unless the entire session settings model is being refactored in the same PR.

### Runtime wiring

The new per-turn options must flow through `start_agent_turn` only. Do not mutate persisted session settings for temporary trait choices.

For Codex, the new runtime handling should be added in `src-tauri/src/agent_runtime/codex.rs`.

If a trait cannot be mapped to a real transport field in the app-server or CLI contract, keep it unimplemented and hidden.

### Acceptance criteria

1. Provider traits are draft-local and survive session switches.
2. Unsupported traits are not shown.
3. Trait selections are passed only on the turns that use them.
4. Changing provider/model normalizes invalid trait combinations.

## Delivery order

Implement in this order:

1. Proposed plans
2. Terminal to agent context
3. Provider traits

Rationale:

1. Proposed plans unlock the highest-value product behavior and replace a weak heuristic.
2. Terminal context is self-contained and highly Divergence-native, but needs app-level routing.
3. Provider traits depend on shared contract work and should follow after the plan/context draft model is stable.

## Testing and validation

### Pure/unit coverage

Add or update tests for:

1. plan readiness and attention logic
2. proposed plan snapshot mapping
3. terminal-context block formatting
4. composer draft persistence with terminal contexts and provider traits
5. provider-trait normalization by provider/model

Likely files:

- `src/entities/workspace-session/lib/workspaceSessionAttention.pure.test.ts`
- `src/features/agent-runtime/lib/agentRuntimeSnapshot.pure.ts`
- new tests under `src/widgets/agent-session-view/lib/`
- new tests around `AgentSessionComposer.container.tsx` if needed

### Validation gate

Run the normal Divergence validation gate after implementation:

1. `npm install`
2. `npm run test:pure`
3. `npm run test:unit`
4. `chaperone check --fix`
5. `cargo clippy -- -D warnings`

## Implementation notes for the next agent

1. Do not chase `t3code` architectural parity. Reuse its behavior only.
2. For proposed plans, start with provider-agnostic capture from completed plan turns.
3. For terminal context, respect Divergence's app-shell reality: terminal and agent views are not simultaneously active.
4. For provider traits, ship only real transport-backed controls, even if the generic UI scaffolding supports more providers later.
5. Keep all new TypeScript code within FSD-lite boundaries and route cross-slice imports through public APIs.
