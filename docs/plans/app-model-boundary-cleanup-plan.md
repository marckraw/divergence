# App Model Boundary Cleanup Plan

Status: Proposed  
Created: 2026-03-25  
Scope: `src/app/model`, related `src/app/api` and `src/app/lib` files that should live in feature slices.

Related references:
- `docs/architecture/quick-reference.md`
- `docs/plans/repository-architecture-migration-plan.md`
- `docs/plans/phase-8-legacy-cleanup-plan.md`

## 1) Why this plan exists

`src/app/model` is currently valid by naming rules, but it mixes multiple concern levels:

1. app-shell orchestration that truly belongs in `app`
2. feature-specific workflows that should live in `features/*`
3. concern-local type contracts and helpers that are colocated under `app` only because the first implementation landed there

This makes `src/app/model` feel inconsistent and harder to reason about. The goal of this plan is to keep `app` focused on shell wiring and move product workflows back to their owning slices.

## 2) Objectives

1. Keep `src/app/model` focused on app-shell state and orchestration.
2. Move feature-owned hooks/types/helpers out of `src/app/*` into their owning `features/*` slices.
3. Improve naming for app-owned registries and operation coordinators.
4. Reduce the semantic overload of the word "model" inside `src/app/model`.
5. Preserve behavior and keep all architecture checks green during the migration.

## 3) Non-goals

1. Rewriting the behavior of inbox polling, task center attachment, review agent launching, or automation orchestration.
2. Large UI refactors.
3. Moving everything out of `src/app/model` only for symmetry.
4. Forcing entity-level code into `entities/*` when the concern is really shell orchestration.

## 4) Decision summary

### 4.1 Keep in `src/app/model`

These files are shell-wide orchestration and should remain app-owned:

- `src/app/model/useSplitPaneManagement.ts`
- `src/app/model/useStageTabGroup.ts`
- `src/app/model/useSidebarLayout.ts`
- `src/app/model/useAppKeyboardShortcuts.ts`
- `src/app/model/useSessionPersistence.ts`
- `src/app/model/useGlobalErrorTracking.ts`
- `src/app/model/useIdleNotification.ts`

### 4.2 Keep in `src/app/model`, but rename for clarity

- `src/app/model/useSessionManagement.ts` -> `src/app/model/useWorkspaceSessionRegistry.ts`
- `src/app/model/useEditorSessionManagement.ts` -> `src/app/model/useEditorSessionRegistry.ts`

Rationale:
- both hooks behave like central registries used by the app shell
- "management" is too vague for long-term architecture

### 4.3 Move out of `src/app`

These files express feature workflows and should be colocated with their owning feature slices:

- `src/app/model/useGithubInboxPolling.ts` -> `src/features/inbox/model/useGithubInboxPolling.ts`
- `src/app/model/useTaskCenterAttachment.ts` -> `src/features/task-center/model/useTaskCenterAttachment.ts`
- `src/app/model/useReviewAgentSession.ts` -> `src/features/review-agent/model/useReviewAgentSession.ts`

Related GitHub inbox support files should move too:

- `src/app/model/githubPullRequests.types.ts` -> `src/features/inbox/model/githubInbox.types.ts`
- `src/app/api/githubPullRequests.api.ts` -> `src/features/inbox/api/githubPullRequests.api.ts`
- `src/app/lib/githubInbox.pure.ts` -> `src/features/inbox/lib/githubInbox.pure.ts`

### 4.4 Split overloaded app coordinators

- `src/app/model/useEntityOperations.ts`
  - split into `src/app/model/useProjectOperations.ts`
  - split into `src/app/model/useWorkspaceOperations.ts`

- `src/app/model/useAutomationOrchestration.ts`
  - keep only shell wiring in `src/app/model/useAutomationShellIntegration.ts`
  - push feature-specific orchestration down into `src/features/automations/*` and `src/features/automation-triggers/*` where practical

## 5) Target structure

```txt
src/app/model/
  useAppKeyboardShortcuts.ts
  useAutomationShellIntegration.ts
  useEditorSessionRegistry.ts
  useGlobalErrorTracking.ts
  useIdleNotification.ts
  useProjectOperations.ts
  useSessionPersistence.ts
  useSidebarLayout.ts
  useSplitPaneManagement.ts
  useStageTabGroup.ts
  useWorkspaceOperations.ts
  useWorkspaceSessionRegistry.ts

src/features/inbox/
  api/githubPullRequests.api.ts
  index.ts
  lib/githubInbox.pure.ts
  model/githubInbox.types.ts
  model/useGithubInboxPolling.ts
  ui/...

src/features/task-center/
  index.ts
  model/useTaskCenter.ts
  model/useTaskCenterAttachment.ts
  ui/...

src/features/review-agent/
  index.ts
  model/useReviewAgentSession.ts

src/features/automations/
  index.ts
  model/...
  service/...

src/features/automation-triggers/
  index.ts
  model/...
  service/...
```

## 6) Implementation rules

### 6.1 App ownership rule

`src/app/model` should contain only hooks/modules that coordinate one or more lower layers on behalf of the app shell.

Good fits for `app/model`:
- shell layout state
- shell-wide keyboard shortcuts
- global persistence/restore
- global session registries
- cross-feature app attention/error wiring

Poor fits for `app/model`:
- a workflow a user would recognize as a discrete feature
- concern-specific helper types for a single feature
- IO helpers and pure helpers that only support one feature

### 6.2 Feature ownership rule

If a hook is primarily about a user workflow such as inbox polling, task center attachment, or launching a review agent, colocate it inside that feature slice and export it through that feature's `index.ts`.

### 6.3 File naming rule

Use the existing repository suffixes exactly:

1. `use*.ts` for hooks
2. `*.types.ts` for local contracts
3. `*.api.ts` for transport/IO boundaries
4. `*.pure.ts` for pure helpers
5. `*.service.ts` for side-effectful use-case orchestration

### 6.4 Public API rule

When moving code into a feature or entity slice, add or update the slice `index.ts` so `src/app/App.container.tsx` and other callers can consume it through public APIs rather than deep private imports across slices.

## 7) Workstreams

## 7.1 Workstream A - Inbox extraction

Goal: move GitHub inbox polling and its local contracts/helpers into `src/features/inbox`.

Files to move:
- [ ] Move `src/app/model/useGithubInboxPolling.ts` to `src/features/inbox/model/useGithubInboxPolling.ts`
- [ ] Move `src/app/model/githubPullRequests.types.ts` to `src/features/inbox/model/githubInbox.types.ts`
- [ ] Move `src/app/api/githubPullRequests.api.ts` to `src/features/inbox/api/githubPullRequests.api.ts`
- [ ] Move `src/app/lib/githubInbox.pure.ts` to `src/features/inbox/lib/githubInbox.pure.ts`

Required follow-up:
- [ ] Export `useGithubInboxPolling` from `src/features/inbox/index.ts`
- [ ] Export any shared inbox-local types only if needed outside the slice
- [ ] Update imports in `src/app/App.container.tsx`
- [ ] Update imports in tests such as `src/app/lib/githubInbox.pure.test.ts` or relocate the test if appropriate

Recommended test relocation:
- [ ] Move `src/app/lib/githubInbox.pure.test.ts` to `src/features/inbox/lib/githubInbox.pure.test.ts`

Definition of done:
- [ ] App imports the hook from `../features/inbox`
- [ ] No GitHub inbox-specific helper or type remains in `src/app/*`
- [ ] Behavior is unchanged

## 7.2 Workstream B - Task center attachment colocation

Goal: colocate task center-specific session attachment behavior with the task center feature.

Files to move:
- [ ] Move `src/app/model/useTaskCenterAttachment.ts` to `src/features/task-center/model/useTaskCenterAttachment.ts`

Required follow-up:
- [ ] Export `useTaskCenterAttachment` from `src/features/task-center/index.ts`
- [ ] Update `src/app/App.container.tsx` to import from `../features/task-center`
- [ ] Keep task-center-specific sidebar behavior unchanged

Definition of done:
- [ ] Task center attachment logic is feature-owned
- [ ] `src/app/model` no longer contains task center-specific behavior

## 7.3 Workstream C - Review agent feature introduction

Goal: introduce a small dedicated feature slice for launching review-agent sessions.

Files to create/move:
- [ ] Create `src/features/review-agent/index.ts`
- [ ] Move `src/app/model/useReviewAgentSession.ts` to `src/features/review-agent/model/useReviewAgentSession.ts`

Required follow-up:
- [ ] Update `src/app/App.container.tsx` to import from `../features/review-agent`
- [ ] Keep the public API minimal: only export the hook unless more surface area is needed

Definition of done:
- [ ] Review-agent launch behavior is feature-owned
- [ ] No review-agent-specific workflow hook remains in `src/app/model`

## 7.4 Workstream D - App registry naming cleanup

Goal: make app-owned registry hooks read as shell infrastructure instead of generic "management".

Files to rename:
- [ ] Rename `src/app/model/useSessionManagement.ts` to `src/app/model/useWorkspaceSessionRegistry.ts`
- [ ] Rename `src/app/model/useEditorSessionManagement.ts` to `src/app/model/useEditorSessionRegistry.ts`

Required follow-up:
- [ ] Update imports in `src/app/App.container.tsx`
- [ ] Update any test or helper imports
- [ ] Keep exported types colocated with the renamed files or split later only if needed

Definition of done:
- [ ] "Management" naming is removed for the two central registries
- [ ] Call sites still read clearly

## 7.5 Workstream E - Split `useEntityOperations`

Goal: remove the catch-all "entity operations" naming and separate project/divergence concerns from workspace concerns.

Target split:
- [ ] Create `src/app/model/useProjectOperations.ts`
- [ ] Create `src/app/model/useWorkspaceOperations.ts`
- [ ] Remove `src/app/model/useEntityOperations.ts` after callers are updated

Suggested ownership split:

`useProjectOperations.ts`
- add project
- remove project
- create divergence
- delete divergence

`useWorkspaceOperations.ts`
- select workspace
- create workspace
- delete workspace
- select workspace divergence
- delete workspace divergence
- open workspace settings
- create workspace divergences

Definition of done:
- [ ] No broad "entity operations" catch-all remains
- [ ] App shell still owns the cross-feature coordination, but with clearer boundaries

## 7.6 Workstream F - Thin `useAutomationOrchestration`

Goal: reduce the size and conceptual overload of automation logic inside `app/model`.

Target approach:
- [ ] Rename the app-owned layer to `src/app/model/useAutomationShellIntegration.ts`
- [ ] Keep only app-shell wiring there:
  - refresh hooks
  - session opening/wiring
  - shell-facing callbacks consumed directly by `src/app/App.container.tsx`
- [ ] Extract feature-specific orchestration into `src/features/automations/*` or `src/features/automation-triggers/*`

Likely extraction candidates:
- cloud event queue polling glue that belongs with automation triggers
- run execution orchestration that belongs with automation services
- automation-specific type shaping that is not shell-owned

Important note:
- this is the riskiest workstream and should happen after Workstreams A-E are complete

Definition of done:
- [ ] The app file is noticeably smaller or conceptually narrower
- [ ] Feature-owned automation behavior is colocated with existing automation slices

## 8) Recommended execution order

1. Workstream A - Inbox extraction
2. Workstream B - Task center attachment
3. Workstream C - Review agent feature introduction
4. Workstream D - App registry naming cleanup
5. Workstream E - Split `useEntityOperations`
6. Workstream F - Thin `useAutomationOrchestration`

Reasoning:
- A-C are clear ownership moves with low ambiguity
- D-E improve naming and local organization without changing conceptual ownership
- F is the most invasive and should happen after the simpler moves reduce clutter

## 9) Pull request strategy

Preferred PR breakdown:

1. PR 1: Inbox extraction
2. PR 2: Task center attachment + review-agent feature
3. PR 3: Registry rename cleanup
4. PR 4: Split `useEntityOperations`
5. PR 5: Thin automation shell integration

If smaller steps are needed, split file moves from internal refactors.

## 10) Acceptance checklist

- [ ] `src/app/model` contains only shell-owned orchestration hooks
- [ ] Feature-specific workflows are colocated in `src/features/*`
- [ ] Moved slices expose clean public APIs via `index.ts`
- [ ] No deep private cross-slice imports are introduced
- [ ] Behavior parity is preserved
- [ ] `npm install`
- [ ] `npm run test:pure`
- [ ] `npm run test:unit`
- [ ] `chaperone check --fix`
- [ ] `cargo clippy -- -D warnings` when run from the Rust workspace root

## 11) Risks and mitigations

Risk:
- App container imports may churn heavily.

Mitigation:
- Keep each workstream focused and update public APIs first.

Risk:
- `useAutomationOrchestration.ts` may hide multiple sub-concerns that are not obvious until extraction begins.

Mitigation:
- Do a dedicated read-first pass before changing Workstream F.
- Prefer extracting one behavior cluster at a time.

Risk:
- Temporary test path churn after moving inbox helpers.

Mitigation:
- Move tests alongside the helpers in the same PR.

## 12) Exit criteria

- `src/app/model` reads as app-shell infrastructure rather than a mixed bucket.
- Inbox, task center, and review-agent workflows are owned by their feature slices.
- Naming of central registries and coordinators is clearer.
- The repository remains green under architecture and test checks.
