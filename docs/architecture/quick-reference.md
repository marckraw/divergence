# Architecture Quick Reference

Updated: 2026-02-06

## Purpose

This is the short, enforceable reference for day-to-day architecture decisions.
For rollout history, see `docs/plans/repository-architecture-migration-plan.md`.

## Layers

Use these top-level TypeScript layers:

1. `src/app`
2. `src/widgets`
3. `src/features`
4. `src/entities`
5. `src/shared`

## Dependency Direction

Allowed imports:

1. `app` -> `widgets`, `features`, `entities`, `shared`
2. `widgets` -> `features`, `entities`, `shared`
3. `features` -> `entities`, `shared`
4. `entities` -> `shared`
5. `shared` -> `shared` only

Not allowed:

1. Any upward import (for example `shared` importing `features`).
2. Direct transport/process access in non-API files (`invoke`, `spawn`, `Database.load`).

## File Suffix Rules

Use the matching suffix for each concern:

1. `*.presentational.tsx`: render only.
2. `*.container.tsx`: state/effects/orchestration.
3. `*.api.ts`: IO/transport boundary (Tauri, PTY, DB, external APIs).
4. `*.service.ts`: side-effectful use-case orchestration.
5. `*.model.ts` or `use*.ts`: state/domain logic.
6. `*.styles.ts`: style constants/class maps.
7. `*.pure.ts`: pure utilities only.
8. `*.types.ts`: local slice types.

## Presentational Rules

`*.presentational.tsx` files must not contain:

1. `useEffect`, `useLayoutEffect`, `useInsertionEffect`.
2. Direct Tauri imports/calls.
3. Process/network bootstrapping (`spawn`, `fetch`).

## Container Rules

`*.container.tsx` files:

1. Own state, effects, and orchestration.
2. Import a colocated `*.presentational.tsx`.
3. Pass typed view models/handlers down via props.

## Import API Rule

Cross-slice imports should use slice public APIs (`index.ts`) instead of deep private paths.

## Enforcement

Architecture checks are enforced by:

1. `chaperone check --fix`
2. `eslint` (architecture rules in `eslint.config.js`)
