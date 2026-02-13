---
"divergence": patch
---

Fix terminal destruction on theme or settings change. Previously, toggling the theme or changing the tmux history limit would destroy the entire terminal and kill the running shell session. Theme changes are now handled in-place without disrupting the terminal.
