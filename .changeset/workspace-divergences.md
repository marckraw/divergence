---
"divergence": minor
---

feat(workspace-divergences): create workspace-level divergences that group per-project divergences

When creating divergences from a workspace, a workspace divergence folder is now also created with symlinks pointing to the per-project divergence paths instead of the originals. This workspace divergence appears under its parent workspace in the sidebar, can be opened as a terminal session, and is searchable via the quick switcher. Deleting a workspace also cleans up associated workspace divergence folders on disk.
