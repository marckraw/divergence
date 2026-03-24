---
"divergence": minor
---

Unified Command Center: replace Quick Switcher, File Quick Switcher, and Pending Stage Pane inline picker with a single mode-driven Command Center modal.

- New `src/features/command-center/` feature slice with keyboard-first search across projects, files, sessions, and create actions
- Four modes: `replace` (Cmd+K), `reveal` (Cmd+Shift+K), `open-file` (Cmd+Shift+O), `open-in-pane` (Cmd+D split)
- Cmd+D / Cmd+Shift+D now immediately opens Command Center targeting the new pane after split
- PendingStagePane simplified to a lightweight placeholder with "Open something here" CTA
- Deleted `features/quick-switcher/` and `features/file-quick-switcher/` (replaced)
- Deleted `pendingStagePane.pure.ts` (logic moved to `commandCenterActions.pure.ts`)
- Cleaned up dead props (`showFileQuickSwitcher`, `onCloseFileQuickSwitcher`, `onReplacePaneRef`, `onCreatePendingSession`) from StageView and StageSidebar
- `handleSplitPane` now returns the new pane ID to support post-split Command Center targeting
