---
---

Fix tmux session termination from the right sidebar Tmux panel by routing kill actions
through the existing app session close+kill flow when the target tmux session is owned
by an open terminal tab. This prevents immediate tmux auto-reconnect from making killed
sessions appear impossible to terminate.
