---
"divergence": patch
---

Replace stderr debug logging with file-based logging for tmux diagnostics in production. Logs are written to ~/Library/Logs/Divergence/tmux-debug.log since eprintln output is not visible for Finder-launched GUI apps on macOS.
