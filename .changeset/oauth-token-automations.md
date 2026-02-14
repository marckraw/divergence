---
"divergence": minor
---

Add Claude OAuth token setting for long-running automations. Store a long-lived token from `claude setup-token` in app settings and inject it as `CLAUDE_CODE_OAUTH_TOKEN` env var into automation tmux sessions. Remove keepalive and auth retry logic from wrapper script in favor of the env-based approach.
