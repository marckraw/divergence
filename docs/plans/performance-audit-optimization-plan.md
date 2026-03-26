# Performance Audit Optimization Plan

Status: Proposed  
Created: 2026-03-26  
Scope: App-shell render behavior, agent runtime subscriptions, polling, large list/tree rendering, diff rendering, and low-risk performance wins across the React/Tauri app.

Related references:
- `docs/architecture/quick-reference.md`
- `docs/plans/repository-architecture-migration-plan.md`
- `docs/plans/phase-1-presentational-container-checklist.md`

## 1) Why this plan exists

The current app appears to have a few broad performance multipliers rather than one isolated hotspot:

1. app-shell render fan-out from `src/app/App.container.tsx`
2. broad invalidation in the agent runtime store
3. repeated polling and repeated derivation work around the same data
4. expensive UI paths for large diffs, trees, and fuzzy-search result sets

This plan captures the biggest bottlenecks found in the audit, plus the safest no-behavior-change improvements that should be prioritized first.

## 2) Objectives

1. Reduce unnecessary rerenders in the app shell.
2. Narrow agent-runtime invalidation so unrelated sessions do not rerender on every update.
3. Eliminate repeated expensive work where one cached or shared result is enough.
4. Reduce steady idle CPU/IO pressure from overlapping pollers.
5. Prioritize low-risk wins before broader architecture changes.

## 3) Non-goals

1. Rewriting the app architecture wholesale.
2. Changing user-facing behavior or workflows.
3. Prematurely introducing complicated caching layers everywhere.
4. Building abstractions that are harder to maintain than the current code.

## 4) Audit summary

### 4.1 Highest-impact bottlenecks

1. App-shell render fan-out from `src/app/App.container.tsx`
2. Global agent-runtime store broadcasts to all subscribers
3. Timeline derivation rebuilt repeatedly as agent histories grow
4. Duplicate git changes polling and derivation
5. Command Center file listing and fuzzy filtering on large data sets
6. Duplicate diff parsing plus non-virtualized large diff rendering
7. File explorer recursive rendering with motion wrappers
8. Resize handlers updating layout state on every mousemove
9. Stacked background polling across multiple features
10. Attention/session-tab state recalculated in render-heavy surfaces

### 4.2 Safest easy wins

1. Parse diffs once, not twice
2. Add in-flight dedupe to `useChangesTree`
3. Throttle pane resize updates with `requestAnimationFrame`
4. Keep keyboard shortcut listeners stable with refs
5. Cache Command Center file lists by root/settings
6. Move attention-state derivation out of tab render loops

## 5) Detailed bottlenecks

## 5.1 App-shell render fan-out

Primary files:
- `src/app/App.container.tsx`
- `src/app/ui/stage-view/StageView.container.tsx`
- `src/app/ui/stage-view/StageSidebar.container.tsx`

Observed issues:
- `App.container.tsx` owns a very large number of subscriptions, maps, derived lists, and orchestration hooks.
- It passes large prop surfaces into shell children.
- Frequent session/agent updates likely bubble through much more UI than necessary.

Examples:
- `src/app/App.container.tsx:371`
- `src/app/App.container.tsx:450`
- `src/app/App.container.tsx:475`
- `src/app/App.container.tsx:673`
- `src/app/App.container.tsx:1721`

Impact:
- shell-wide rerenders during streaming agent sessions
- sidebar, tab bar, and stage shell updating more often than they should

Safer fix direction:
- reduce top-level derived prop churn
- move narrower subscriptions closer to panes/widgets
- split shell concerns into smaller hooks/selectors with memoized outputs

## 5.2 Agent runtime store over-broadcasting

Primary files:
- `src/features/agent-runtime/model/agentRuntimeStore.ts`
- `src/features/agent-runtime/model/useAgentRuntime.ts`

Observed issues:
- one global listener set is notified on every runtime update
- session-specific consumers still subscribe through global store updates

Examples:
- `src/features/agent-runtime/model/agentRuntimeStore.ts:73`
- `src/features/agent-runtime/model/agentRuntimeStore.ts:200`
- `src/features/agent-runtime/model/agentRuntimeStore.ts:255`

Impact:
- unrelated agent UI can rerender when any session changes
- cost grows with more simultaneous/open sessions

Safer fix direction:
- add selector-based subscriptions
- add per-session subscription channels
- separate capabilities/open-session lists from individual session snapshots

## 5.3 Agent timeline rebuild cost

Primary files:
- `src/widgets/agent-session-view/lib/agentTimeline.pure.ts`
- `src/app/ui/stage-view/AgentStagePane.container.tsx`
- `src/widgets/agent-session-view/ui/AgentSessionView.container.tsx`

Observed issues:
- full message/activity history is merged, sorted, and grouped repeatedly
- similar derivation is consumed in more than one UI surface

Impact:
- long agent sessions get progressively heavier
- streaming and scrolling can feel slower over time

Safer fix direction:
- compute timeline once per session snapshot
- cache by last activity/message identity
- reuse derived timeline data across surfaces

## 5.4 Duplicate git changes polling

Primary files:
- `src/features/changes-tree/model/useChangesTree.ts`
- `src/widgets/agent-session-view/ui/AgentSessionHeader.container.tsx`
- `src/app/ui/stage-view/StageSidebar.container.tsx`

Observed issues:
- refresh on mount, on focus, and optional 5-second polling
- same root path can be polled by multiple mounted consumers

Examples:
- `src/features/changes-tree/model/useChangesTree.ts:49`
- `src/features/changes-tree/model/useChangesTree.ts:97`
- `src/features/changes-tree/model/useChangesTree.ts:106`

Impact:
- duplicate git IO
- unnecessary CPU spikes and state churn when focus returns to the app

Safer fix direction:
- one shared changes cache/poller per `rootPath`
- dedupe in-flight refreshes
- skip focus refresh while already loading

## 5.5 Command Center scaling issues

Primary files:
- `src/features/command-center/ui/CommandCenter.container.tsx`
- `src/features/command-center/lib/commandCenter.pure.ts`
- `src/features/command-center/api/commandCenter.api.ts`

Observed issues:
- full file lists are fetched when file-aware modes open
- large mixed result sets are rebuilt and re-filtered often
- fuzzy matching and sorting cost rises with repo size

Examples:
- `src/features/command-center/ui/CommandCenter.container.tsx:54`
- `src/features/command-center/ui/CommandCenter.container.tsx:98`
- `src/features/command-center/lib/commandCenter.pure.ts:40`
- `src/features/command-center/lib/commandCenter.pure.ts:198`

Impact:
- slow palette open
- query keystroke lag on large repositories

Safer fix direction:
- cache file lists by root path and exclude settings
- reuse prebuilt result sets where possible
- cap fuzzy work earlier or lazily

## 5.6 Diff rendering hot path

Primary files:
- `src/widgets/main-area/ui/QuickEditDrawer.container.tsx`
- `src/shared/unified-diff-viewer/ui/UnifiedDiffViewer.presentational.tsx`

Observed issues:
- diff parsing is duplicated
- all diff lines are rendered directly
- line asides/footers can increase row cost further

Examples:
- `src/widgets/main-area/ui/QuickEditDrawer.container.tsx:72`
- `src/shared/unified-diff-viewer/ui/UnifiedDiffViewer.presentational.tsx:45`

Impact:
- slow open/render for large diffs
- scroll jank in large patch views

Safer fix direction:
- parse once and pass parsed lines down
- add size thresholds for heavy adornments
- consider virtualization for large diffs in a later phase

## 5.7 File explorer rendering cost

Primary file:
- `src/widgets/main-area/ui/FileExplorer.container.tsx`

Observed issues:
- recursive rendering of all visible nodes
- animated layout wrappers for many entries
- repeated row creation for large expanded trees

Examples:
- `src/widgets/main-area/ui/FileExplorer.container.tsx:189`
- `src/widgets/main-area/ui/FileExplorer.container.tsx:205`

Impact:
- expanding large folders can feel heavy
- unnecessary DOM and motion overhead for large trees

Safer fix direction:
- reduce motion for larger visible trees
- flatten visible rows for later virtualization
- memoize row-level rendering where useful

## 5.8 Resize handlers causing drag-time rerenders

Primary files:
- `src/app/ui/stage-view/StageView.container.tsx`
- `src/widgets/main-area/ui/MainArea.container.tsx`

Observed issues:
- drag handlers update layout continuously on every mousemove

Examples:
- `src/app/ui/stage-view/StageView.container.tsx:306`

Impact:
- noticeable drag jank when heavy panes are mounted

Safer fix direction:
- throttle via `requestAnimationFrame`
- keep transient drag state in refs and commit less often

## 5.9 Background poller accumulation

Primary files:
- `src/features/inbox/model/useGithubInboxPolling.ts`
- `src/features/automation-triggers/model/useCloudAutomationEventPoller.ts`
- `src/features/automations/model/useAutomationRunPoller.ts`
- `src/features/usage-limits/model/useUsageLimits.ts`
- `src/app/model/useAutomationShellIntegration.ts`

Observed issues:
- several independent timers poll network, runtime, or git-related state
- some ticks do multi-step sequential work per item

Examples:
- `src/features/automation-triggers/model/useCloudAutomationEventPoller.ts:28`
- `src/features/automations/model/useAutomationRunPoller.ts:63`
- `src/features/usage-limits/model/useUsageLimits.ts:14`

Impact:
- idle background pressure
- bursts of updates landing together and disturbing UI smoothness

Safer fix direction:
- centralize and coordinate poll scheduling where practical
- skip work while hidden/inactive where safe
- share in-flight and cached results

## 5.10 Session attention derivation in render loops

Primary files:
- `src/widgets/workspace-session-tabs/ui/WorkspaceSessionTabs.presentational.tsx`
- `src/app/App.container.tsx`
- `src/app/ui/stage-view/StageView.container.tsx`

Observed issues:
- tab attention state is derived per rendered tab and can be recomputed frequently

Examples:
- `src/widgets/workspace-session-tabs/ui/WorkspaceSessionTabs.presentational.tsx:61`
- `src/widgets/workspace-session-tabs/ui/WorkspaceSessionTabs.presentational.tsx:65`

Impact:
- low-to-medium persistent overhead that increases with open sessions

Safer fix direction:
- precompute attention flags in a memoized selector layer
- pass down plain display data to tab UI

## 6) Workstreams

## 6.1 Workstream A - Safe wins first

Goal: land low-risk optimizations that should not materially change behavior.

Tasks:
- [ ] Parse diffs once and pass parsed lines to the diff viewer
- [ ] Add in-flight refresh dedupe to `useChangesTree`
- [ ] Skip focus refresh in `useChangesTree` while already loading
- [ ] Throttle stage/main-area resize updates with `requestAnimationFrame`
- [ ] Keep `useAppKeyboardShortcuts` listener stable via refs
- [ ] Cache Command Center file lists by root path and listing options
- [ ] Precompute session attention state before tab rendering

Definition of done:
- [ ] no user-facing behavior changes
- [ ] no increased architecture complexity out of proportion to the gain

## 6.2 Workstream B - Polling dedupe and coordination

Goal: reduce duplicate background work and repeated refreshes.

Tasks:
- [ ] Introduce a shared changes-tree cache/poller keyed by `rootPath`
- [ ] Reuse the shared changes state in agent header/sidebar consumers
- [ ] Audit all pollers for visibility-aware skipping and in-flight dedupe
- [ ] Reduce overlapping refreshes between inbox, automations, and shell integration where possible

Definition of done:
- [ ] same repo path is not polled independently by multiple mounted UI consumers
- [ ] background work is measurably reduced in idle states

## 6.3 Workstream C - Agent runtime subscription narrowing

Goal: prevent unrelated agent-session surfaces from rerendering on every runtime update.

Tasks:
- [ ] Add session-scoped selectors/subscriptions in `agentRuntimeStore`
- [ ] Separate capabilities/open-session list subscriptions from per-session subscriptions
- [ ] Audit `useAgentRuntime`, `useAgentRuntimeSession`, and session consumers for broad invalidation

Definition of done:
- [ ] updating one agent session does not invalidate unrelated session views by default

## 6.4 Workstream D - Expensive derivation reuse

Goal: stop rebuilding expensive derived structures multiple times.

Targets:
- [ ] agent timeline derivation
- [ ] tab/session attention derivation
- [ ] command-center search-result assembly when source data did not change

Definition of done:
- [ ] repeated expensive pure derivations are cached or reused where appropriate

## 6.5 Workstream E - Large view rendering improvements

Goal: improve performance in the heaviest visual surfaces.

Targets:
- [ ] diff viewer large-content strategy
- [ ] file explorer large-tree strategy
- [ ] command-center large-result strategy

Possible tactics:
- size thresholds
- lighter rendering modes
- virtualization where justified

Definition of done:
- [ ] large diffs, trees, and search result sets degrade more gracefully

## 7) Recommended execution order

1. Workstream A - Safe wins first
2. Workstream B - Polling dedupe and coordination
3. Workstream C - Agent runtime subscription narrowing
4. Workstream D - Expensive derivation reuse
5. Workstream E - Large view rendering improvements

Reasoning:
- Workstream A gives immediate wins with low breakage risk.
- Workstream B reduces idle and duplicate work before more invasive render work.
- Workstream C addresses one of the highest-impact systemic issues.
- Workstream D and E become easier once broad invalidation and duplicate polling are reduced.

## 8) Pull request strategy

Preferred PR breakdown:

1. PR 1: safe wins only
2. PR 2: changes-tree polling/cache dedupe
3. PR 3: agent-runtime selector/subscription improvements
4. PR 4: derivation reuse for timeline/attention/command center
5. PR 5: large diff/tree/search rendering improvements

If needed, split PR 1 into:
- resize + keyboard stability
- diff parse dedupe
- command-center file-list caching

## 9) Profiling guidance before medium-risk changes

Run React Profiler and performance traces on:

1. `src/app/App.container.tsx` during active agent streaming
2. `src/app/ui/stage-view/StageView.container.tsx` during pane drag and session switching
3. `src/features/agent-runtime/model/agentRuntimeStore.ts` during multi-session runtime updates
4. `src/features/command-center/ui/CommandCenter.container.tsx` on a large repository
5. `src/widgets/main-area/ui/QuickEditDrawer.container.tsx` while opening a large diff

Measure specifically:

1. rerender counts for shell surfaces during one agent event
2. duplicate git status/branch change calls per root path
3. command-center open/query latency
4. large diff render time and DOM row count
5. drag-time frame rate while panes are mounted

## 10) Acceptance checklist

- [ ] app-shell rerender scope is reduced in common hot paths
- [ ] agent-runtime updates are more narrowly subscribed
- [ ] duplicate git refresh work is reduced
- [ ] command-center large repo behavior is improved
- [ ] large diff rendering avoids obvious duplicate work
- [ ] drag interactions are smoother
- [ ] no regressions in shell behavior or feature workflows
- [ ] `npm install`
- [ ] `npm run test:pure`
- [ ] `npm run test:unit`
- [ ] `chaperone check --fix`
- [ ] `cargo clippy -- -D warnings` when run from the Rust workspace root

## 11) Risks and mitigations

Risk:
- caching or selector changes may accidentally serve stale data

Mitigation:
- prefer narrow, explicit invalidation rules
- add tests for cache invalidation and subscription behavior where possible

Risk:
- performance fixes in hot paths may increase code complexity too much

Mitigation:
- prioritize simple safe wins first
- avoid optimization layers without a clear measured payoff

Risk:
- polling coordination could subtly delay updates the UI currently expects

Mitigation:
- preserve current cadence initially while deduping duplicate requests
- only reduce frequency after measuring impact

Risk:
- virtualization may complicate UX in diffs and trees

Mitigation:
- use thresholds and incremental rollout
- avoid virtualization unless simpler optimizations are insufficient

## 12) Exit criteria

- the app no longer does obvious duplicate work in major hot paths
- active agent sessions cause less shell-wide invalidation
- polling is more coordinated and less redundant
- large diffs, trees, and search result sets have a clearer performance strategy
- the repository remains green under lint, tests, and architecture checks
