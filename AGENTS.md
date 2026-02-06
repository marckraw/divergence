# Agent Instructions

## Post-task requirement

Always run `npm install` to make sure all the dependencies are there after every finished task.
Always run `npm run test:unit` after every finished task.
Always run `chaperone check --fix` after every finished task.
Always run `cargo clippy -- -D warnings` after every finished task.

## Architecture and File Organization (2026)

Source of truth:
- `docs/plans/repository-architecture-migration-plan.md`
- `docs/plans/phase-1-presentational-container-checklist.md`
- `docs/architecture/quick-reference.md`

### Required folder strategy

Organize TypeScript code using these layers:
- `src/app`
- `src/shared`
- `src/entities`
- `src/features`
- `src/widgets`

Do not add new long-term code under flat legacy areas when a layer above exists for that concern.

### Required file naming conventions

Use these suffixes for new or migrated files:
- `*.presentational.tsx`: render-only component, props in -> JSX out
- `*.container.tsx`: state/effects/orchestration wrapper for UI
- `*.styles.ts`: styling constants and class maps only
- `*.api.ts`: IO boundaries (Tauri/plugin/network calls)
- `*.service.ts`: side-effectful use-case orchestration
- `*.model.ts` or `use*.ts`: local state/domain logic
- `*.pure.ts`: pure utilities only
- `*.types.ts`: local types for a slice/feature

### Presentational vs container rules

`*.presentational.tsx` files must not contain side-effectful orchestration:
- no `useEffect` / `useLayoutEffect` / `useInsertionEffect`
- no direct Tauri imports/calls (`@tauri-apps/*`, `invoke`, DB access)
- no direct fetch/process/network bootstrapping

`*.container.tsx` files:
- own side effects and state wiring
- pass view models/handlers to presentational components

When creating a new container component, co-locate a matching presentational component unless there is a clear exception.

### Import boundary rules

Use these dependency directions:
- `app` -> `widgets`, `features`, `entities`, `shared`
- `widgets` -> `features`, `entities`, `shared`
- `features` -> `entities`, `shared`
- `entities` -> `shared`
- `shared` -> `shared`

Cross-slice imports must go through that slice `index.ts` public API. Avoid deep private imports across slices.

### Migration behavior for agents

When touching large legacy component files, prefer opportunistic migration toward this model (especially Phase 1 presentational/container split) if risk is acceptable for the current task.

All architecture/naming/boundary checks must remain green under configured lint/chaperone rules.
Architecture lint/chaperone violations are treated as blocking issues.
