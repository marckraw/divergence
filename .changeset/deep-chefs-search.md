---
---

Improve tmux terminal reliability under heavy multi-terminal usage by:

- adding Rust-side timeouts around tmux and login-shell probe commands,
- switching tmux context probing away from interactive shell startup,
- adding frontend timeout guards and in-flight request deduplication for tmux list/diagnostics APIs,
- preventing indefinite "Loading..." states when tmux discovery stalls.
