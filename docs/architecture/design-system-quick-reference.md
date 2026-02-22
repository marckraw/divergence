# Design System Quick Reference

Updated: 2026-02-22

## Purpose

Operational guide for UI consistency in Divergence.

Use alongside:

1. `docs/architecture/quick-reference.md`
2. `docs/plans/design-system-rollout-plan.md`

## Shared UI source

Use `src/shared/ui` for domain-agnostic primitives.
Consume them via public APIs:

1. `src/shared/ui/index.ts`
2. `src/shared/index.ts`

Do not deep-import `shared/ui/*` from features/widgets/entities/app files.

## Required default primitives

Prefer these before raw elements:

1. `Button`
2. `IconButton`
3. `ModalShell` (+ `ModalOverlay`, `ModalPanel`)
4. `TextInput`
5. `Textarea`
6. `Select`
7. `FormField`
8. `FormMessage`
9. `Panel`
10. `SectionHeader`

Legacy primitives (`ToolbarButton`, `MenuButton`, `TabButton`) remain valid for compatibility during migration.

## Modal rule

When implementing overlays/dialogs:

1. Use `ModalShell` for overlay + panel composition.
2. Keep side-effect logic in container files.
3. Keep modal content in presentational files.

## Button rule

When implementing clickable actions:

1. Use `Button` for standard actions.
2. Use `IconButton` for icon-only actions.
3. Avoid raw `<button>` in app/widgets/features/entities unless there is a documented exception.

## Form control rule

When implementing text/select controls:

1. Prefer `TextInput`, `Textarea`, `Select`.
2. Use `FormField`/`FormMessage` for labels and validation messages.
3. Keep style maps in `*.styles.ts`.

## Chaperone enforcement posture

Current rollout mode:

1. Warning-first for design-system adoption rules.
2. Architecture and boundary rules stay error-level.

Warning-first means:

1. CI remains non-blocking for new design-system warnings initially.
2. Rules will ratchet to errors after migration convergence.

## Do / Don't

Do:

1. `import { Button, ModalShell } from "../../../shared";`
2. keep presentational files side-effect free.

Don't:

1. duplicate raw overlay shell classes (`fixed inset-0 ... bg-black/50`) in each feature.
2. deep-import `shared/ui/Button.presentational` from feature/widget code.
3. add long-term UI primitives outside `src/shared/ui`.
