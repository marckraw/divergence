# Phase 8 Cleanup Plan: Retire Legacy Root Adapters

Status: Complete  
Created: 2026-02-06  
Scope: remove compatibility roots and finalize layered placement after Phases 0-7.

## Objectives

1. Remove legacy compatibility adapters under `src/components`.
2. Migrate remaining flat `src/hooks` and `src/lib/utils` logic into layered folders.
3. Tighten enforcement so legacy root structure cannot reappear.

## Completed work

- [x] Removed `src/components/*` compatibility adapter files.
- [x] Removed `src/widgets/main-area/ui/*` compatibility adapters that re-exported `*.container.tsx`.
- [x] Removed legacy hook adapters in `src/hooks` and relocated hook logic to:
  - `src/shared/hooks`
  - `src/entities/project/model`
  - `src/entities/terminal-session/model`
- [x] Migrated legacy root libs/utilities into layered folders:
  - `src/shared/config`
  - `src/shared/lib`
  - `src/app/lib`
  - `src/entities/project/lib`
  - `src/entities/terminal-session/lib`
  - `src/widgets/main-area/lib`
  - `src/widgets/sidebar/lib`
  - `src/widgets/settings-modal/lib`
  - `src/features/quick-switcher/lib`
  - `src/features/file-quick-switcher/lib`
- [x] Updated imports across `src/**` and `tests/**` to new paths.
- [x] Expanded Chaperone enforcement:
  - ban imports from legacy root directories (`src/components`, `src/hooks`, `src/lib`),
  - ban new files under legacy root directories.
- [x] Verified architecture checks and test suite remain green.

## Outcome

The repository now uses only layered source roots for active code:

1. `src/app`
2. `src/shared`
3. `src/entities`
4. `src/features`
5. `src/widgets`

Legacy roots are fully retired and policy-enforced.
