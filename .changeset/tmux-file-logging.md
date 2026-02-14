---
"divergence": patch
---

Fix tmux sessions not appearing in production mode by replacing tab separator with ::: in tmux list-sessions format strings. Add file-based debug logging at ~/Library/Logs/Divergence/tmux-debug.log for production diagnostics.
