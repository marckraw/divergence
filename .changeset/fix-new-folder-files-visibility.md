---
"divergence": patch
---

fix: show individual files inside new folders in agent session changes tab

Previously, when a new folder with new files was created, only the folder was displayed in the changes tree without its child files. This was because `git status --porcelain=v2` defaults to showing untracked directories as a single entry. Adding `--untracked-files=all` ensures git reports each individual untracked file, allowing the changes tree to display a full expandable hierarchy.
