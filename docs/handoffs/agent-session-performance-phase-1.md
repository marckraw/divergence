# Agent Session Performance Handoff

Updated: 2026-03-09

## What Changed

- `useAgentRuntime` now reads from a frontend store instead of owning all session state in one hook instance.
- `AgentSessionView` now subscribes to the active session by id, instead of receiving the full active session snapshot from `App.container`.
- draft text and attachment staging state moved into `AgentSessionComposer.container.tsx`
- draft persistence changed from per-keystroke `sessionStorage` writes to a debounced flush
- runtime telemetry ticking moved into `AgentSessionHeader.container.tsx`
- the conversation timeline now renders through `react-virtuoso`

## Performance Intent

- typing in the composer should no longer rerender the full thread
- the 1-second runtime clock should no longer rerender the timeline
- closed runtime-debug sections should not render their detail payloads

## Validation

- `npm run typecheck`
- `npm run test:pure`
- `npm run test:unit`
- `chaperone check --fix`
- `cargo clippy -- -D warnings`

## Remaining Watchpoints

- the sidebar/tab surfaces still resubscribe to session-list changes globally
- timeline row memoization depends on message/activity field comparisons, not stable object identity
- virtualization needs manual QA with long mixed message/activity threads
