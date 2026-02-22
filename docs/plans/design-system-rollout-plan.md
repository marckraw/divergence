# Design System Rollout Plan (2026)

Status: In progress  
Owner: Core team  
Created: 2026-02-22  
Scope: `src/**` (TypeScript/React)

## 1) Why this plan exists

Divergence has strong architecture enforcement (FSD-lite, presentational/container split, API boundaries), but UI primitives are still partially ad-hoc.

The highest-impact consistency gaps are:

1. Repeated modal shell implementations.
2. Repeated raw button patterns.
3. Repeated form-control class strings.

This plan standardizes shared UI primitives and enforces usage with Chaperone in warning-first mode.

## 2) Goals

1. Define reusable, domain-agnostic primitives in `src/shared/ui`.
2. Migrate prioritized feature/widget surfaces to those primitives.
3. Enforce migration via deterministic Chaperone rules.
4. Keep existing architecture constraints green throughout.

## 3) Non-goals

1. Full visual redesign.
2. Big-bang migration.
3. Replacing FSD-lite architecture with a different model.

## 4) Source of truth

1. `docs/architecture/quick-reference.md`
2. `docs/architecture/design-system-quick-reference.md`
3. `AGENTS.md`
4. `.chaperone.json`

## 5) Shared primitives target set

## 5.1 Phase 1 primitives

1. `Button.presentational.tsx`
2. `IconButton.presentational.tsx`
3. `ModalOverlay.presentational.tsx`
4. `ModalPanel.presentational.tsx`
5. `ModalShell.presentational.tsx`

## 5.2 Phase 2 primitives

1. `TextInput.presentational.tsx`
2. `Textarea.presentational.tsx`
3. `Select.presentational.tsx`
4. `FormField.presentational.tsx`
5. `FormMessage.presentational.tsx`
6. `Panel.presentational.tsx`
7. `SectionHeader.presentational.tsx`

## 5.3 Shared styles maps

1. `button.styles.ts`
2. `modal.styles.ts`
3. `form.styles.ts`

## 6) Phases

## Phase 0 - docs + warning enforcement

Deliverables:

1. Add this rollout doc and quick reference.
2. Add warning rules to Chaperone for:
   - raw modal shell classes,
   - raw buttons outside `shared/ui`,
   - deep `shared/ui` imports instead of public API.
3. Keep warnings global (no allowlist).

Exit criteria:

1. `chaperone check` deterministic with warning output.
2. No architecture errors introduced.

## Phase 1 - modal + button migration

Deliverables:

1. Ship modal/button primitives in `src/shared/ui`.
2. Migrate first-wave overlays and action buttons:
   - `create-divergence`
   - `workspace-management` modals
   - `quick-switcher`
   - `file-quick-switcher`

Exit criteria:

1. First-wave components consume shared modal shell and button primitives.
2. Warning count for overlay/button patterns decreases.

## Phase 2 - form + surface migration

Deliverables:

1. Ship form/surface primitives.
2. Migrate high-volume form UI areas:
   - settings modal editor areas,
   - automations editor,
   - task inspect modal,
   - workspace settings,
   - inbox filter/action controls.

Exit criteria:

1. Core settings and automation forms use shared controls.
2. Duplicate class-string patterns reduced.

## Phase 3 - hardening and ratchet

Deliverables:

1. Convert high-signal warning rules to error level in migrated scopes.
2. Keep noisy heuristics as warnings until migration convergence.
3. Update onboarding docs and agent policy references.

Exit criteria:

1. Regressions are blocked by CI in hardened scopes.
2. New UI follows shared primitives by default.

## Phase 4 - convergence and cleanup

Deliverables:

1. Migrate remaining stragglers.
2. Remove redundant compatibility primitives where safe.
3. Finalize docs with stable component usage guidance.

Exit criteria:

1. Modal/button/form patterns are broadly standardized.
2. Design-system enforcement is stable and low-noise.

## 7) Validation workflow per task

Run after each task:

1. `npm install`
2. `npm run test:pure`
3. `npm run test:unit`
4. `chaperone check --fix`
5. `cargo clippy -- -D warnings`

## 8) Risks and mitigations

1. Risk: warning noise can be high initially.
   Mitigation: warnings are intentionally global; migration order targets highest-duplication hotspots first.
2. Risk: style regressions during component swaps.
   Mitigation: keep variant APIs small and migration PRs scoped by surface.
3. Risk: boundary regressions.
   Mitigation: rely on existing ESLint + Chaperone architecture rules.

## 9) Completion notes template

For each phase milestone, record:

1. migrated files/slices,
2. warning trend,
3. remaining hotspots,
4. decisions and follow-up.
