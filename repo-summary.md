# Repository Summary (Divergence)

## Repository Purpose
- **Name**: Divergence
- **Type**: Tauri desktop app (React + TypeScript frontend + Rust backend)
- **Domain**: Project/workstream orchestration with embedded terminals, Git divergence workflows, and agent-assisted review/automation.

## Tech Stack
- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS
- **Desktop runtime**: Tauri 2 (Rust + TypeScript bridge)
- **Terminal**: pty + xterm.js
- **Datastore**: SQLite via `tauri-plugin-sql` (plus Drizzle ORM)
- **Runtime dependencies**: CodeMirror, Framer Motion, Radix UI, Drizzle ORM, Zod, Vitest

## Architecture
- Repository follows **FSD-lite** and enforces layered boundaries:
  - `app` → `widgets` → `features` → `entities` → `shared`
- Legacy roots (`src/components`, `src/hooks`, `src/lib`) are retired.
- Presentational/Container split is in place (`*.presentational.tsx`, `*.container.tsx`).
- I/O is intended to live in `*.api.ts`; orchestration in `*.service.ts` / `*.model.ts`.

## Source Layout (as of now)
- `src/`: 504 files
- `src/app`: 41 files
- `src/entities`: 85 files
- `src/features`: 170 files
- `src/widgets`: 87 files
- `src/shared`: 116 files
- `src-tauri/src`: 16 Rust files
- `tests`: 4 files (plus 81 colocated `*.test.ts` / `*.pure.test.ts` files under `src`)

## Frontend Composition
- Entry:
  - `src/main.tsx` mounts app in `#root`
  - `src/App.tsx` re-exports `src/app/App.container.tsx`
  - `src/app/App.container.tsx` performs global orchestration and composes widgets/features
- Major feature/widget/entity slices visible from file map:
  - **Entities**: project, divergence, workspace, terminal-session, task, automation, workspace/session, stage-layout, etc.
  - **Features**: quick-switcher, create/delete-divergence, merge-detection, task-center, automations, file quick-switcher, github-pr-hub, workspace mgmt, usage limits, etc.
  - **Widgets**: sidebar, main-area, settings-modal, workspace-session-tabs, agent-session-view
  - **Shared**: API wrappers, hooks, services, lib utilities, and reusable UI primitives

## Backend (Rust)
- Rust crate: `src-tauri/Cargo.toml` (name `divergence`)
- App entry: `src-tauri/src/main.rs`
- Tauri bootstrap and command registration in `src-tauri/src/lib.rs`
- Key backend modules:
  - `commands.rs` (Tauri invoke command surface)
  - `db.rs` / `git.rs` / `agent_runtime/*` / `ws_*` / `usage_limits.rs`
  - tray/menu handling and close/minimize behavior is handled in app setup

## Quality & Governance
- Posture is strongly enforced by:
  - `chaperone` (`.chaperone.json`) with architecture/purity/component-boundary rules
  - ESLint config (imports, architecture, and React/TS rules)
  - CI workflow (`.github/workflows/ci.yml`) running lint, typecheck, tests, build, and clippy
- Release process:
  - `changesets`-driven PR release workflow
  - Tag creation script: `scripts/tag-release.mjs`
  - Version sync between npm and Cargo: `scripts/sync-version.mjs`

## Important Root Docs/Instructions
- `README.md`: user-facing product overview and shortcuts
- `AGENTS.md` and `CLAUDE.md`: agent/tasking constraints and architecture rules
- `docs/architecture/quick-reference.md`: enforcement-facing architecture reference
- `docs/plans/repository-architecture-migration-plan.md`: historical migration roadmap (currently marked complete through phase 7)
- `docs/plans/phase-1-presentational-container-checklist.md`: container/presentational checklist
- `docs/plans/phase-8-legacy-cleanup-plan.md`: legacy root retirement notes

## Key Scripts
- `npm run dev`
- `npm run build`
- `npm run lint`
- `npm run test:pure` (chaperone check)
- `npm run test:unit` (pure checks + Vitest)
- `npm run tauri dev`
- `npm run tauri build`
- `cargo clippy -- -D warnings` (via CI and AGENTS post-task requirement)

## Notes
- This repository is in a migration-advanced state: structure and guards are consistent with the documented architecture rather than "legacy mixed" style.
