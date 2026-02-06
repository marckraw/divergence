# Repository Architecture Migration Plan (2026)

Status: In Progress (Phases 0-6 complete; Phase 7 hardening pending)  
Owner: Core team  
Created: 2026-02-06  
Scope: `src/**` (TypeScript/React), then policy sync in `AGENTS.md` and `CLAUDE.md`

## 1) Why this plan exists

The codebase is growing quickly and already has large orchestration files (`src/App.tsx`, `src/components/MainArea.tsx`, `src/components/QuickEditDrawer.tsx`).  
Without strict structure and naming conventions, long-term maintenance cost will compound.

This plan defines a sustainable architecture and migration sequence that can be executed over multiple PRs without requiring a big-bang rewrite.

## 2) Goals

1. Enforce clear separation between rendering components and side-effect/state orchestration.
2. Move from flat component organization to feature/domain-oriented structure.
3. Introduce deterministic enforcement (Chaperone + ESLint boundaries + naming rules).
4. Keep migration safe with phased rollouts and measurable exit criteria.

## 3) Non-goals

1. Rewriting the Rust backend in this effort.
2. Large UI redesign.
3. Forcing all files to move at once.

## 4) Target architecture model

Use FSD-lite with clear app boundaries:

```txt
src/
  app/                  # app bootstrap, providers, global wiring
  shared/               # generic reusable blocks
    ui/
    lib/
    hooks/
    api/
    config/
  entities/             # business domain entities (project/divergence/session/task)
    <entity>/
      model/
      ui/
      lib/
      index.ts
  features/             # user actions/use-cases
    <feature>/
      model/
      ui/
      api/
      lib/
      index.ts
  widgets/              # composed screen sections (Sidebar/MainArea/etc)
    <widget>/
      model/
      ui/
      index.ts
```

## 5) Filename and placement conventions

Primary conventions:

1. `*.presentational.tsx`
   - Props-in, JSX-out.
   - No `useEffect`, no data fetching, no Tauri `invoke`, no DB/network/process side effects.
2. `*.container.tsx`
   - Owns state/effects/orchestration.
   - May call hooks/services/apis.
3. `*.styles.ts`
   - Class maps/tokens/style constants only.
4. `*.model.ts` or `use*.ts`
   - Local state, reducers, selectors, business state logic.
5. `*.service.ts`
   - Side-effectful use-case orchestration.
6. `*.api.ts`
   - IO boundaries (Tauri invoke, plugin wrappers, external APIs).
7. `*.pure.ts`
   - Pure computation utilities only.
8. `*.types.ts`
   - Local type contracts for a slice/feature.

Directory rules:

1. `shared/ui` has no domain-coupled naming or business behavior.
2. `features/*` may depend on `entities/*` and `shared/*`, not on other features directly.
3. `widgets/*` may compose features/entities/shared.
4. `app/*` may depend on all lower layers.
5. Cross-feature imports should go through explicit public APIs (`index.ts`) only.

## 6) Layer dependency policy

Allowed dependency direction:

1. `app` -> `widgets`, `features`, `entities`, `shared`
2. `widgets` -> `features`, `entities`, `shared`
3. `features` -> `entities`, `shared`
4. `entities` -> `shared`
5. `shared` -> `shared` only

Disallowed:

1. `shared` importing from `entities/features/widgets/app`
2. `entities` importing from `features/widgets/app`
3. `features` importing from `widgets/app`
4. Any layer importing private files from another slice (must use that slice `index.ts`)

## 7) Rollout phases

## Phase 0 - Baseline and guardrails

Deliverables:

1. Create this plan and keep it updated per phase.
2. Establish migration tracking board/checklist.
3. Add architecture section to `AGENTS.md` and `CLAUDE.md` (policy source of truth).
4. Add initial `.chaperone.json` custom rules in warning mode where needed.
5. Add ESLint architecture tooling (`eslint-plugin-boundaries` and/or `eslint-plugin-check-file`).

Exit criteria:

1. CI runs architecture lint and Chaperone checks.
2. New code is blocked if it violates critical boundaries.

## Phase 1 - Presentational/container split (first priority)

Deliverables:

1. Introduce `*.presentational.tsx` and `*.container.tsx` naming convention.
2. Execute the detailed checklist in `docs/plans/phase-1-presentational-container-checklist.md`.
3. Start with high-value UI modules:
   - `MainArea`
   - `Sidebar`
   - `Settings`
   - `TaskCenterDrawer`
   - `QuickSwitcher`
4. Extract pure render portions into presentational files and keep orchestration in containers.
5. Keep behavior parity with no UX regressions.

Exit criteria:

1. No side-effect hooks in `*.presentational.tsx`.
2. Container files own data loading/effects and pass props to presentation files.
3. Existing unit tests pass; add missing tests where behavior moved.

## Phase 2 - Shared UI and primitive extraction

Deliverables:

1. Introduce `src/shared/ui`.
2. Extract reusable UI primitives and micro-components (buttons, badges, status indicators, empty states).
3. Move style constants to `*.styles.ts` when useful.

Exit criteria:

1. Duplicate generic UI logic reduced.
2. Shared components are domain-agnostic.

## Phase 3 - Domain slices (`entities`)

Deliverables:

1. Introduce entity slices:
   - `entities/project`
   - `entities/divergence`
   - `entities/terminal-session`
   - `entities/task`
2. Move domain-specific pure utilities and entity-local types into each entity slice.
3. Add public APIs via `index.ts`.

Exit criteria:

1. Entity logic is no longer scattered across unrelated folders.
2. Import paths follow entity boundaries.

## Phase 4 - Use-case slices (`features`)

Deliverables:

1. Create feature slices for major use-cases:
   - `create-divergence`
   - `delete-divergence`
   - `quick-switcher`
   - `file-quick-switcher`
   - `task-center`
   - `merge-detection`
2. Move orchestration logic from monolithic files into feature-local `model/service/api`.

Exit criteria:

1. `App` orchestration complexity reduced.
2. Feature behavior can evolve independently.

## Phase 5 - Screen composition (`widgets`) and app shell cleanup

Deliverables:

1. Move screen sections to widgets:
   - `widgets/sidebar`
   - `widgets/main-area`
   - `widgets/settings-modal`
2. Keep `app` as composition and global providers only.
3. Minimize direct business logic in root composition files.

Exit criteria:

1. `src/App.tsx` becomes primarily wiring/composition.
2. Widget APIs are clear and stable.

## Phase 6 - IO boundary standardization

Deliverables:

1. Consolidate direct `invoke` calls into feature/entity api modules (`*.api.ts`).
2. Normalize error handling and DTO mapping.
3. Keep UI unaware of transport details.

Exit criteria:

1. Container/model layers call typed API wrappers, not raw Tauri calls in random places.

## Phase 7 - Hardening and docs completion

Deliverables:

1. Finalize `AGENTS.md` and `CLAUDE.md` with enforceable conventions.
2. Finalize Chaperone and ESLint rules to error level.
3. Add architecture quick-reference doc for onboarding.

Exit criteria:

1. New contributors can follow structure without tribal knowledge.
2. CI deterministically enforces conventions.

## 8) Chaperone enforcement plan

Use `rules.custom` with these rule types:

1. `component-location` for presentational/stateful placement.
2. `regex` for forbidden usage patterns inside presentational files.
3. `regex` for container/presentational pairing checks.

Example rule set shape (to be refined in implementation PR):

```json
{
  "rules": {
    "custom": [
      {
        "type": "component-location",
        "id": "presentational-in-ui-folders",
        "severity": "error",
        "files": "src/**/*.presentational.tsx",
        "componentType": "presentational",
        "requiredLocation": "src/**/ui/",
        "mustBeIn": true
      },
      {
        "type": "regex",
        "id": "no-side-effects-in-presentational",
        "severity": "error",
        "files": "src/**/*.presentational.tsx",
        "pattern": "\\\\b(useEffect|invoke|Database\\\\.load|fetch)\\\\b",
        "message": "Presentational components cannot contain side effects"
      },
      {
        "type": "regex",
        "id": "container-imports-presentational",
        "severity": "warning",
        "files": "src/**/*.container.tsx",
        "pattern": "^(?![\\\\s\\\\S]*from\\\\s+[\\\"']\\\\./[^\\\"']+\\\\.presentational[\\\"'])[\\\\s\\\\S]+$",
        "message": "Container components should import a colocated *.presentational component (missing import detected)"
      }
    ]
  }
}
```

Note: Current Chaperone `file-naming` companion transforms cannot strip a `.container` suffix from `$1`, so pairing is enforced via a regex violation pattern for now.

## 9) ESLint enforcement plan

Add rules for:

1. Layer import boundaries.
2. Filename patterns (`*.presentational.tsx`, `*.container.tsx`, etc).
3. Restricted imports (forbid direct raw `invoke` in presentation files).

Candidate plugins:

1. `eslint-plugin-boundaries`
2. `eslint-plugin-check-file`

## 10) Migration strategy and risk control

Execution style:

1. Migrate one slice/widget at a time.
2. Keep PRs small and reviewable.
3. Preserve behavior before structure changes.
4. Add or update tests for moved logic.

Risk mitigations:

1. Use temporary compatibility exports to avoid large breakage.
2. Run unit tests after each phase milestone.
3. Promote rules from warning to error only after migration of impacted scope.

## 11) Tracking checklist

- [x] Phase 0 complete
- [x] Phase 1 complete
- [x] Phase 2 complete
- [x] Phase 3 complete
- [x] Phase 4 complete
- [x] Phase 5 complete
- [x] Phase 6 complete
- [ ] Phase 7 complete

Current progress notes:
1. `features/task-center` and `features/quick-switcher` are introduced and consumed by app composition.
2. `widgets/sidebar`, `widgets/main-area`, and `widgets/settings-modal` entry points are introduced and consumed by app composition.
3. `Sidebar`, `MainArea`, and `Settings` container/presentational/type implementations now live under `src/widgets/*/ui`.
4. Legacy `src/components/Sidebar.tsx`, `src/components/MainArea.tsx`, and `src/components/Settings.tsx` remain compatibility adapters.
5. Main-area support components (`ProjectSettingsPanel`, `FileExplorer`, `ChangesPanel`, `TmuxPanel`, `QuickEditDrawer`, `FileQuickSwitcher`, `Terminal`) now live under `src/widgets/main-area/ui`.
6. App orchestration moved to `src/app/App.container.tsx` with compatibility adapter `src/App.tsx`.
7. `features/create-divergence` now owns divergence-create modal UI and validation utility, with legacy compatibility adapters in `src/components/CreateDivergenceModal.tsx` and `src/lib/utils/createDivergence.ts`.
8. `features/merge-detection` now owns merge detection hook + merge notification UI, with legacy compatibility adapters in `src/hooks/useMergeDetection.ts` and `src/components/MergeNotification.tsx`.
9. `features/file-quick-switcher` now exists with `container/presentational/types` split and is consumed by `widgets/main-area`.
10. Core type contracts are now organized into `entities/project`, `entities/divergence`, and `entities/terminal-session`, with compatibility re-exports in `src/types.ts`.
11. `features/delete-divergence` now owns delete orchestration via `*.service.ts`, and `src/app/App.container.tsx` delegates delete workflow to that service.
12. `features/create-divergence` now owns divergence creation orchestration via `*.service.ts`, and `src/app/App.container.tsx` delegates create workflow to that service.
13. `features/remove-project` now owns project removal orchestration via `*.service.ts`, and `src/app/App.container.tsx` delegates remove workflow to that service.
14. Tmux kill-session IO is now consolidated in `src/shared/api/tmuxSessions.api.ts`, and delete/remove feature services call this shared API directly.
15. Feature IO boundaries were tightened with dedicated API modules: `features/create-divergence/api/createDivergence.api.ts`, `features/delete-divergence/api/deleteDivergence.api.ts`, and `features/merge-detection/api/mergeDetection.api.ts`.
16. Shared task runner contracts are now centralized in `entities/task` (`BackgroundTaskControls`, `BackgroundTaskRunOptions`, `RunBackgroundTask`) and reused by create/delete/remove feature type definitions.
17. Database bootstrap/schema setup moved to `src/shared/api/database.api.ts`; `src/hooks/useDatabase.ts` is now a compatibility adapter.
18. Project/divergence query and mutation hooks moved under entity slices (`entities/project/model/useProjects.ts`, `entities/divergence/model/useDivergences.ts`) with entity-local `*.api.ts` DB boundaries.
19. `src/hooks/useTmuxSessions.ts` now calls `src/shared/api/tmuxSessions.api.ts` wrappers for list/kill/kill-all operations (no direct raw invoke calls in the hook).
20. `src/lib/projectSettings.ts` now imports `getDb` directly from `src/shared/api/database.api.ts` instead of the legacy hook adapter.
21. `src/hooks/useRalphyConfig.ts` now calls `src/shared/api/ralphyConfig.api.ts` and consumes shared Ralphy response/types from `src/shared/api/ralphyConfig.types.ts`.
22. Container-level raw invoke calls were moved behind `*.api.ts` wrappers in create-divergence, file-quick-switcher, main-area, and settings-modal slices.
23. PTY spawn/process entry points are standardized in `src/shared/api/pty.api.ts`, and hook/widget consumers (`useTerminal`, `Terminal`) now call those wrappers.
24. Main-area support modules now follow incremental `*.container.tsx` naming (`ChangesPanel`, `FileExplorer`, `ProjectSettingsPanel`, `QuickEditDrawer`, `Terminal`, `TmuxPanel`) with compatibility adapters kept at legacy paths.
25. Repository scan now confirms transport/process boundaries: raw `invoke(...)` and `spawn(...)` calls are confined to `*.api.ts` files only.

Repository coverage audit (2026-02-06):
1. Reviewed migration coverage across `src/app`, `src/components`, `src/entities`, `src/features`, `src/hooks`, `src/lib`, `src/shared`, `src/widgets`, plus `tests` and `src-tauri` for scope checks.
2. `src/components/*.tsx` is now consistently a compatibility adapter layer to widget/feature/shared modules.
3. Remaining work is now concentrated in Phase 7 hardening:
   - Add explicit ESLint architecture boundary tooling/rules (`eslint-plugin-boundaries` and/or `eslint-plugin-check-file`) and keep it CI-enforced.
   - Decide whether to promote the current Chaperone warning-level pairing/location checks to error-level after final compatibility adapters are retired.
   - Add a short architecture quick-reference onboarding doc.

## 12) Success metrics

1. Reduced average file size in orchestration-heavy components.
2. Reduced cross-domain imports.
3. Zero `error`-level boundary violations in CI.
4. Faster onboarding and clearer ownership boundaries.

## 13) Decisions to lock before implementation

1. Exact suffix set to enforce from day one.
2. Which files are in Phase 1 migration scope.
3. Whether companion pairing (`container` <-> `presentational`) is warning or error initially.
4. Boundary strictness level for first rollout (warning-first vs error-first).
