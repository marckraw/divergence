# Agent Session Performance Plan

Updated: 2026-03-09

## Goals

- remove visible typing lag from the agent composer
- keep long conversations responsive as turns and runtime activities accumulate
- preserve current agent-runtime behavior while shrinking the render/update surface

## Refactor Shape

1. Move draft persistence and draft input state into the composer boundary.
2. Move the runtime telemetry clock into the header boundary.
3. Virtualize the conversation timeline and lazy-render debug details.
4. Narrow frontend runtime subscriptions so the active session view reads its own session snapshot directly.

## Phase Breakdown

### Phase 1

- introduce the frontend agent-runtime store and direct active-session subscription
- isolate composer state from the main conversation tree

### Phase 2

- split header/timeline/composer render domains
- move the telemetry clock out of the main agent-session container

### Phase 3

- virtualize the timeline
- lazy-render runtime debug detail blocks
- validate no regressions under typecheck, pure/unit tests, Chaperone, and clippy
