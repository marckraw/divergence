# Phase 1 Execution Checklist: Presentational/Container Split

Status: In Progress  
Primary objective: introduce `*.presentational.tsx` and `*.container.tsx` as the default component pattern for UI orchestration boundaries.  
Related plan: `docs/plans/repository-architecture-migration-plan.md`

## 1) Scope for Phase 1

In scope:
- `src/components/MainArea.tsx`
- `src/components/Sidebar.tsx`
- `src/components/Settings.tsx`
- `src/components/TaskCenterDrawer.tsx`
- `src/components/QuickSwitcher.tsx`

Out of scope:
- Rust backend restructuring
- Full `entities/features/widgets` relocation (handled in later phases)
- Visual redesign

## 2) Definition of done for each migrated component

- [ ] Container file exists: `ComponentName.container.tsx`
- [ ] Presentational file exists: `ComponentName.presentational.tsx`
- [ ] Container owns effects/state/data orchestration
- [ ] Presentational has no side-effectful logic
- [ ] Existing behavior is unchanged
- [ ] Tests pass after migration
- [ ] Imports in call-sites updated cleanly

## 3) Implementation rules for this phase

- [ ] Use suffix naming exactly: `.container.tsx` and `.presentational.tsx`
- [ ] Keep props explicit and typed between container and presentational
- [ ] Keep event handlers in container unless trivially local UI-only
- [ ] Keep `invoke`, database calls, and async orchestration in container or service/api files
- [ ] Avoid moving concerns across domains in this phase (pure split first)
- [ ] Keep PRs focused on one component migration each where possible

## 4) Recommended migration order

1. `TaskCenterDrawer` (smallest risk, good template)
2. `QuickSwitcher`
3. `Settings`
4. `Sidebar`
5. `MainArea` (largest, most complex, do last)

## 5) Per-component checklist

## 5.1 TaskCenterDrawer

- [x] Create `src/components/TaskCenterDrawer.container.tsx`
- [x] Create `src/components/TaskCenterDrawer.presentational.tsx`
- [x] Move timer/effect logic (`nowMs` interval) to container
- [x] Keep card rendering and pure visual structure in presentational
- [x] Keep exported API compatible for current call-site

## 5.2 QuickSwitcher

- [x] Create `src/components/QuickSwitcher.container.tsx`
- [x] Create `src/components/QuickSwitcher.presentational.tsx`
- [x] Move query state, keyboard handlers, selection logic to container
- [x] Keep result list rendering and static visuals in presentational
- [x] Ensure keyboard navigation behavior parity (`↑`, `↓`, `Enter`, `Escape`)

## 5.3 Settings

- [x] Create `src/components/Settings.container.tsx`
- [x] Create `src/components/Settings.presentational.tsx`
- [x] Keep update check/install orchestration in container
- [x] Keep form rendering, sections, and visual controls in presentational
- [x] Preserve save behavior and settings normalization flow

## 5.4 Sidebar

- [x] Create `src/components/Sidebar.container.tsx`
- [x] Create `src/components/Sidebar.presentational.tsx`
- [x] Keep context menu state and divergence actions in container
- [x] Keep project/divergence tree rendering in presentational
- [x] Preserve expand/collapse, selection, and context menu behavior

## 5.5 MainArea

- [x] Create `src/components/MainArea.container.tsx`
- [x] Create `src/components/MainArea.presentational.tsx`
- [x] Keep file IO + diff loading + save logic in container
- [x] Keep terminal tabbar and right panel rendering in presentational
- [x] Keep split/reconnect callbacks routed through container
- [x] Verify Quick Edit drawer behavior parity (dirty checks, save, close)

## 6) Verification checklist per PR

- [x] `npm run test:unit`
- [x] `chaperone check --fix`
- [ ] Manual smoke test for affected component flow
- [ ] No behavior regressions in keyboard shortcuts or modal interactions

## 7) Risk and rollback notes

- [x] Preserve legacy file exports temporarily if needed to reduce churn
- [x] If migration causes broad call-site churn, add adapter exports for one PR cycle
- [ ] If behavior differs, revert to previous step and split into smaller extraction commits

## 8) Exit criteria for Phase 1

- [x] All five in-scope components migrated
- [x] `*.presentational.tsx` and `*.container.tsx` conventions established in active usage
- [x] Chaperone rules active for presentational-side effect constraints
- [x] Agent instruction files updated (AGENTS/CLAUDE) and aligned with practice
