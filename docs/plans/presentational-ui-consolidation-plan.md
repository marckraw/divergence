# Presentational UI Consolidation Plan

Status: Proposed  
Created: 2026-03-25  
Scope: React container/presentational boundaries across `src/app`, `src/widgets`, `src/features`, and shared UI consolidation in `src/shared/ui`.

Related references:
- `docs/architecture/quick-reference.md`
- `docs/plans/repository-architecture-migration-plan.md`
- `docs/plans/phase-1-presentational-container-checklist.md`

## 1) Why this plan exists

The repository already uses the container/presentational pattern successfully, but several large React files still mix orchestration with significant render-only JSX. At the same time, multiple UI patterns are being implemented more than once across widgets and features.

This plan exists to:

1. push more render-only UI into `*.presentational.tsx` files
2. reduce duplicated UI patterns across the app
3. strengthen `src/shared/ui` as the source of truth for reusable visual primitives
4. prevent the same component concept from being recreated in multiple places

## 2) Objectives

1. Extract render-only sections from large containers into presentational components.
2. Consolidate repeated UI shells and micro-patterns into reusable primitives.
3. Keep domain-specific UI local when the duplication is only superficial.
4. Preserve existing UX and visual language.
5. Improve DRY discipline without introducing generic, hard-to-maintain abstractions.

## 3) Non-goals

1. Rewriting app behavior.
2. Redesigning the UI system from scratch.
3. Promoting every repeated class string into `src/shared/ui`.
4. Forcing different domain cards into one generic card component when their content and behavior differ.

## 4) Guiding rules

### 4.1 Presentational extraction rule

Create a `*.presentational.tsx` file when a container contains a substantial block of JSX that is:

1. props-in / JSX-out
2. free of side effects and orchestration
3. easier to test or reason about as a view model + renderer pair

Keep in the container:

1. effects and subscriptions
2. async handlers and data loading
3. persistence, timers, debouncing, and window listeners
4. feature coordination and cross-slice wiring

### 4.2 DRY rule

If the same component concept appears in two or more places, do not keep re-implementing it ad hoc.

Use this ownership model:

1. `src/shared/ui` for generic visual primitives and structural shells
2. `src/features/<feature>/ui` for repeated UI that is still feature-domain specific
3. `src/widgets/<widget>/ui` for repeated UI that is widget-specific but not globally generic

### 4.3 Abstraction rule

Do not create broad, over-configurable generic components just to remove a few repeated lines.

A shared component should exist only when:

1. the concept is meaningfully the same across files
2. the prop model stays understandable
3. the resulting API is easier to use than the duplication it replaces

## 5) Highest-priority container extraction candidates

## 5.1 `src/app/ui/stage-view/StageSidebar.container.tsx`

Why:
- largest remaining app-shell container with significant render-only UI
- mixes state/effects with tab strips, panel shells, and session-specific sidebar rendering

Target extraction:
- [ ] Create `src/app/ui/stage-view/StageSidebar.presentational.tsx`
- [ ] Create `src/app/ui/stage-view/StageSidebarTabStrip.presentational.tsx`
- [ ] Extract a render-only focused-pane/session summary block
- [ ] Consider view-only subpanels for terminal/editor/agent modes if prop shape remains manageable

Keep in container:
- `useFileEditor`
- queue hooks
- review-draft hooks
- tab state and effectful handlers

## 5.2 `src/widgets/agent-session-view/ui/AgentSessionComposer.container.tsx`

Why:
- strong candidate with heavy orchestration plus a large JSX tree

Target extraction:
- [ ] Create `src/widgets/agent-session-view/ui/AgentSessionComposer.presentational.tsx`
- [ ] Extract widget-local attachment list/chip presentationals
- [ ] Extract widget-local footer/help row presentational

Keep in container:
- draft persistence
- attachment staging
- skill discovery and slash handling
- imperative ref wiring

## 5.3 `src/widgets/agent-session-view/ui/AgentSessionHeader.container.tsx`

Why:
- state and effects are small compared with the amount of render-only metadata/debug UI

Target extraction:
- [ ] Create `src/widgets/agent-session-view/ui/AgentSessionHeader.presentational.tsx`
- [ ] Create `src/widgets/agent-session-view/ui/AgentRuntimeDebugPanel.presentational.tsx`
- [ ] Create `src/widgets/agent-session-view/ui/PendingRequestNotice.presentational.tsx` if needed

Keep in container:
- timer for telemetry age
- provider/model/effort option assembly
- `useChangesTree`

## 5.4 `src/widgets/agent-session-view/ui/AgentSessionTimeline.container.tsx`

Why:
- virtualization should stay in the container, but timeline rows are mostly pure UI

Target extraction:
- [ ] Create `src/widgets/agent-session-view/ui/AgentTimelineMessageRow.presentational.tsx`
- [ ] Create `src/widgets/agent-session-view/ui/AgentTimelineActivityRow.presentational.tsx`
- [ ] Create `src/widgets/agent-session-view/ui/AgentTimelineActivityGroupRow.presentational.tsx`

Keep in container:
- virtualization glue
- memoization boundaries and list wiring

## 5.5 `src/widgets/editor-session-view/ui/EditorSessionView.container.tsx`

Why:
- narrow orchestration, large view shell
- overlaps strongly with two other files that render editor/drawer shells

Target extraction:
- [ ] Create `src/widgets/editor-session-view/ui/EditorSessionView.presentational.tsx`

Keep in container:
- `useEffect` loading/apply-view-state orchestration
- tab resolution logic if it remains coupled to state shape

## 5.6 `src/app/ui/stage-view/AgentStagePane.container.tsx`

Why:
- approval and user-input request areas are mostly view rendering

Target extraction:
- [ ] Create `src/app/ui/stage-view/AgentPendingApprovalBar.presentational.tsx`
- [ ] Create `src/app/ui/stage-view/AgentPendingQuestionForm.presentational.tsx`

Keep in container:
- request-answer state
- request submission handlers
- session-setting updates

## 6) Shared DRY opportunities

## 6.1 Shared editor/drawer shell

Current duplication exists across:
- `src/widgets/editor-session-view/ui/EditorSessionView.container.tsx`
- `src/widgets/agent-session-view/ui/AgentSessionChangeDrawer.container.tsx`
- `src/widgets/main-area/ui/QuickEditDrawer.container.tsx`

Repeated concepts:
- title/path header rows
- read-only/save/close action areas
- diff/edit/view tab strips
- warning/error banners
- markdown/diff/editor body switching
- nearly identical motion and tab panel structure

Decision:
- this belongs in `src/shared/ui`

Target components:
- [ ] Create `src/shared/ui/DocumentPanelShell.presentational.tsx`
- [ ] Create `src/shared/ui/DocumentPanelHeader.presentational.tsx`
- [ ] Create `src/shared/ui/DocumentPanelTabs.presentational.tsx`
- [ ] Optionally create `src/shared/ui/DocumentPanelBannerStack.presentational.tsx`

Notes:
- keep the content slots local
- do not force every editor/drawer into one monolith; prefer a shell + slots model

## 6.2 Git changes UI consolidation

Current duplication exists across:
- `src/features/changes-tree/ui/ChangesTree.presentational.tsx`
- `src/widgets/agent-session-view/ui/AgentSessionChangedFiles.presentational.tsx`
- `src/widgets/main-area/ui/ChangesPanel.container.tsx`

Repeated concepts:
- `STATUS_STYLES`
- file badge rendering
- folder/file row structure
- renamed path secondary line

Decision:
- this belongs in `src/features/changes-tree/ui`, not `src/shared/ui`

Target components:
- [ ] Create `src/features/changes-tree/ui/ChangeStatusBadge.presentational.tsx`
- [ ] Create `src/features/changes-tree/ui/ChangeFileBadge.presentational.tsx`
- [ ] Create `src/features/changes-tree/ui/ChangeTreeNode.presentational.tsx`

Notes:
- changes UI is domain-specific, so keep ownership close to the feature
- `AgentSessionChangedFiles.presentational.tsx` should consume these feature-local building blocks rather than maintaining its own duplicate tree rendering

## 6.3 Header shell consolidation

Existing shared components:
- `src/shared/ui/PanelHeader.presentational.tsx`
- `src/shared/ui/SectionHeader.presentational.tsx`
- `src/shared/ui/ModalHeader.presentational.tsx`

But similar manual headers still appear in:
- `src/features/github-pr-hub/ui/GithubPrHub.presentational.tsx`
- `src/widgets/settings-modal/ui/Settings.presentational.tsx`
- `src/features/project-search/ui/ProjectSearchPanel.presentational.tsx`
- `src/features/changes-tree/ui/ChangesTree.presentational.tsx`
- `src/widgets/main-area/ui/TmuxPanel.container.tsx`

Decision:
- improve and reuse `src/shared/ui` primitives rather than keep hand-rolled headers

Target components:
- [ ] Create `src/shared/ui/PanelToolbar.presentational.tsx`
- [ ] Create `src/shared/ui/FilterHeader.presentational.tsx`
- [ ] Clarify when to use `PanelHeader` vs `SectionHeader`

Definition of done:
- common panel headers use shared shells unless the layout is materially different

## 6.4 Modal body/footer/form shell consolidation

Repeated modal/form structure exists across:
- `src/features/workspace-management/ui/CreateWorkspaceModal.presentational.tsx`
- `src/features/workspace-management/ui/CreateWorkspaceDivergenceModal.presentational.tsx`
- `src/features/create-divergence/ui/CreateDivergenceModal.presentational.tsx`
- `src/features/automations/ui/AutomationsPanel.presentational.tsx`
- `src/widgets/settings-modal/ui/Settings.presentational.tsx`

Decision:
- belongs in `src/shared/ui`

Target components:
- [ ] Create `src/shared/ui/ModalBody.presentational.tsx`
- [ ] Create `src/shared/ui/FormModalShell.presentational.tsx`
- [ ] Ensure `ModalHeader.presentational.tsx` and `ModalFooter.presentational.tsx` are the default for modal framing

## 6.5 Shared filter/search toolbar pieces

Parallel implementations exist across:
- `src/features/project-search/ui/ProjectSearchPanel.presentational.tsx`
- `src/features/linear-task-queue/ui/LinearTaskQueuePanel.presentational.tsx`
- `src/features/inbox/ui/InboxPanel.presentational.tsx`
- `src/features/github-pr-hub/ui/GithubPrHub.presentational.tsx`
- `src/widgets/main-area/ui/TmuxPanel.container.tsx`
- `src/widgets/main-area/ui/ChangesPanel.container.tsx`

Decision:
- structural pieces belong in `src/shared/ui`
- domain-specific filter items remain local

Target components:
- [ ] Create `src/shared/ui/SearchField.presentational.tsx`
- [ ] Create `src/shared/ui/FilterChipGroup.presentational.tsx`
- [ ] Reuse `PanelToolbar.presentational.tsx` for search/filter/action rows

## 6.6 Checkbox and settings field rows

Repeated patterns appear across settings and creation forms:
- `src/widgets/settings-modal/ui/Settings.presentational.tsx`
- `src/features/create-divergence/ui/CreateDivergenceModal.presentational.tsx`
- `src/features/workspace-management/ui/CreateWorkspaceModal.presentational.tsx`
- `src/features/workspace-management/ui/CreateWorkspaceDivergenceModal.presentational.tsx`
- `src/features/automations/ui/AutomationsPanel.presentational.tsx`

Decision:
- belongs in `src/shared/ui`

Target components:
- [ ] Create `src/shared/ui/CheckboxRow.presentational.tsx`
- [ ] Create `src/shared/ui/FieldGroup.presentational.tsx`

## 6.7 Status pills and metadata chips

Repeated ad hoc pill UI exists across:
- `src/widgets/agent-session-view/ui/AgentSessionHeader.container.tsx`
- `src/widgets/agent-session-view/ui/AgentSessionTimeline.container.tsx`
- `src/features/github-pr-hub/ui/GithubPrHub.presentational.tsx`
- `src/features/linear-task-queue/ui/LinearTaskQueuePanel.presentational.tsx`
- `src/features/task-center/ui/TaskCenterPage.presentational.tsx`

Existing base primitive:
- `src/shared/ui/Badge.presentational.tsx`

Decision:
- use/extend `Badge.presentational.tsx` rather than hand-rolling every pill
- tone mapping stays local when domain-specific

Target work:
- [ ] Audit and replace manual rounded-pill metadata chips where practical
- [ ] Add a small set of non-domain badge variants only if the current variants are insufficient

## 6.8 Attachment chip reuse

Current duplication:
- `src/widgets/agent-session-view/ui/AgentSessionComposer.container.tsx`
- `src/widgets/agent-session-view/ui/AgentSessionTimeline.container.tsx`

Decision:
- keep widget-local for now

Target component:
- [ ] Create `src/widgets/agent-session-view/ui/AttachmentChip.presentational.tsx`

Promotion rule:
- only move to `src/shared/ui` if attachment chips spread beyond agent-session surfaces

## 7) Cases where duplication is acceptable

These should remain local even if they are visually similar:

1. task cards in `src/features/task-center/ui/TaskCenterPage.presentational.tsx`
2. PR cards in `src/features/github-pr-hub/ui/GithubPrHub.presentational.tsx`
3. automation cards in `src/features/automations/ui/AutomationsPanel.presentational.tsx`
4. agent timeline row variants that share layout family but represent different semantic content
5. approval and user-input request panels in `src/app/ui/stage-view/AgentStagePane.container.tsx`

Rule:
- same styling family does not automatically mean same component
- consolidate only when the semantic role and prop model are truly aligned

## 8) Workstreams

## 8.1 Workstream A - Shared shell primitives

Goal: create the shared UI primitives that will make later extraction easier.

Tasks:
- [ ] Add document/editor shell primitives under `src/shared/ui`
- [ ] Add panel toolbar / filter header primitives under `src/shared/ui`
- [ ] Add modal body / form modal shell primitives under `src/shared/ui`
- [ ] Add checkbox/field row primitives under `src/shared/ui`
- [ ] Review `Badge.presentational.tsx` usage and fill any small gaps

Definition of done:
- [ ] at least one existing screen can adopt each new primitive cleanly
- [ ] no overly-generic prop soup APIs

## 8.2 Workstream B - Document panel shell adoption

Goal: remove duplicated editor/drawer shell rendering.

Targets:
- [ ] `src/widgets/editor-session-view/ui/EditorSessionView.container.tsx`
- [ ] `src/widgets/agent-session-view/ui/AgentSessionChangeDrawer.container.tsx`
- [ ] `src/widgets/main-area/ui/QuickEditDrawer.container.tsx`

Definition of done:
- [ ] header/tab/banner/body shell duplication is materially reduced
- [ ] behavior and motion remain intact

## 8.3 Workstream C - Changes UI consolidation

Goal: make `features/changes-tree` the source of truth for changes rendering fragments.

Tasks:
- [ ] extract shared feature-local presentational pieces from `ChangesTree.presentational.tsx`
- [ ] reuse them in `AgentSessionChangedFiles.presentational.tsx`
- [ ] reduce duplicate `STATUS_STYLES`, folder/file rows, and file badge markup

Definition of done:
- [ ] git changes visual language is implemented once per concern

## 8.4 Workstream D - Agent session widget extraction

Goal: split the biggest remaining widget containers into render-only presentationals.

Targets:
- [ ] `AgentSessionComposer.container.tsx`
- [ ] `AgentSessionHeader.container.tsx`
- [ ] `AgentSessionTimeline.container.tsx`
- [ ] widget-local attachment chip presentational

Definition of done:
- [ ] containers mostly read as orchestration hooks + view-model assembly

## 8.5 Workstream E - Stage shell extraction

Goal: simplify stage-shell files after reusable primitives exist.

Targets:
- [ ] `StageSidebar.container.tsx`
- [ ] `AgentStagePane.container.tsx`
- [ ] optionally `StageView.container.tsx` if prop shape remains manageable

Definition of done:
- [ ] stage containers become notably easier to scan

## 9) Recommended execution order

1. Workstream A - Shared shell primitives
2. Workstream B - Document panel shell adoption
3. Workstream C - Changes UI consolidation
4. Workstream D - Agent session widget extraction
5. Workstream E - Stage shell extraction

Reasoning:
- shared primitives increase leverage for later work
- document shell duplication is the highest-confidence DRY win
- stage-shell extraction becomes easier after reusable headers, toolbars, and shell pieces exist

## 10) Pull request strategy

Preferred PR breakdown:

1. PR 1: shared UI primitives only
2. PR 2: document panel shell adoption
3. PR 3: changes-tree consolidation
4. PR 4: agent-session widget presentationals
5. PR 5: stage-shell presentationals

If a PR grows too large, split primitive creation from primitive adoption.

## 11) Acceptance checklist

- [ ] large containers have fewer inline render-only sections
- [ ] new `*.presentational.tsx` files are introduced where render logic is substantial
- [ ] duplicated UI patterns are consolidated to the correct ownership layer
- [ ] `src/shared/ui` is used as the source of truth for generic structural UI
- [ ] feature-specific repeated UI stays feature-owned when domain-specific
- [ ] no deep private cross-slice imports are introduced
- [ ] behavior parity is preserved
- [ ] `npm install`
- [ ] `npm run test:pure`
- [ ] `npm run test:unit`
- [ ] `chaperone check --fix`
- [ ] `cargo clippy -- -D warnings` when run from the Rust workspace root

## 12) Risks and mitigations

Risk:
- shared primitives may become too abstract and harder to use than the duplicated markup

Mitigation:
- create small structural primitives, not giant configurable meta-components

Risk:
- extracting `StageSidebar.container.tsx` or `StageView.container.tsx` too early may create prop bloat

Mitigation:
- first introduce view-model objects or smaller subpresentationals
- do not force a single giant presentational if multiple smaller ones are clearer

Risk:
- consolidating changes UI into `src/shared/ui` would lose domain ownership

Mitigation:
- keep git-change rendering under `src/features/changes-tree`

Risk:
- visual inconsistencies may appear during incremental migration

Mitigation:
- adopt shared primitives in the highest-duplicate areas first

## 13) Exit criteria

- the remaining large containers are mostly orchestration, not mixed render/orchestration files
- the editor/drawer shell is no longer implemented multiple times
- git changes rendering has a single source of truth
- shared panel/header/modal/filter primitives are reused instead of recreated ad hoc
- the codebase is more DRY without losing clear ownership boundaries
