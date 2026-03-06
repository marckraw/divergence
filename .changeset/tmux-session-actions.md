---
"divergence": patch
---

Fix tmux session kill actions so sessions are terminated against the correct tmux server and disappear promptly from the tmux sessions panel.

Stop auto-reconnecting terminal sessions after intentional clean exits, which prevents killed tmux sessions from immediately respawning.
