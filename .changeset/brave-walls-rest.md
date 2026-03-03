---
"divergence": patch
---

Refactor: extract hooks from large container components to reduce per-file complexity. App.container.tsx, MainArea.container.tsx, and QuickEditDrawer.container.tsx each had their self-contained concerns extracted into dedicated hook and pure module files. No functional changes.
