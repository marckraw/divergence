# Phase 1 Execution Checklist: Presentational/Container Split

Status: Planned  
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

- [ ] Create `src/components/TaskCenterDrawer.container.tsx`
- [ ] Create `src/components/TaskCenterDrawer.presentational.tsx`
- [ ] Move timer/effect logic (`nowMs` interval) to container
- [ ] Keep card rendering and pure visual structure in presentational
- [ ] Keep exported API compatible for current call-site

## 5.2 QuickSwitcher

- [ ] Create `src/components/QuickSwitcher.container.tsx`
- [ ] Create `src/components/QuickSwitcher.presentational.tsx`
- [ ] Move query state, keyboard handlers, selection logic to container
- [ ] Keep result list rendering and static visuals in presentational
- [ ] Ensure keyboard navigation behavior parity (`↑`, `↓`, `Enter`, `Escape`)

## 5.3 Settings

- [ ] Create `src/components/Settings.container.tsx`
- [ ] Create `src/components/Settings.presentational.tsx`
- [ ] Keep update check/install orchestration in container
- [ ] Keep form rendering, sections, and visual controls in presentational
- [ ] Preserve save behavior and settings normalization flow

## 5.4 Sidebar

- [ ] Create `src/components/Sidebar.container.tsx`
- [ ] Create `src/components/Sidebar.presentational.tsx`
- [ ] Keep context menu state and divergence actions in container
- [ ] Keep project/divergence tree rendering in presentational
- [ ] Preserve expand/collapse, selection, and context menu behavior

## 5.5 MainArea

- [ ] Create `src/components/MainArea.container.tsx`
- [ ] Create `src/components/MainArea.presentational.tsx`
- [ ] Keep file IO + diff loading + save logic in container
- [ ] Keep terminal tabbar and right panel rendering in presentational
- [ ] Keep split/reconnect callbacks routed through container
- [ ] Verify Quick Edit drawer behavior parity (dirty checks, save, close)

## 6) Verification checklist per PR

- [ ] `npm run test:unit`
- [ ] `chaperone check --fix`
- [ ] Manual smoke test for affected component flow
- [ ] No behavior regressions in keyboard shortcuts or modal interactions

## 7) Risk and rollback notes

- [ ] Preserve legacy file exports temporarily if needed to reduce churn
- [ ] If migration causes broad call-site churn, add adapter exports for one PR cycle
- [ ] If behavior differs, revert to previous step and split into smaller extraction commits

## 8) Exit criteria for Phase 1

- [ ] All five in-scope components migrated
- [ ] `*.presentational.tsx` and `*.container.tsx` conventions established in active usage
- [ ] Chaperone rules active for presentational-side effect constraints
- [ ] Agent instruction files updated (AGENTS/CLAUDE) and aligned with practice
