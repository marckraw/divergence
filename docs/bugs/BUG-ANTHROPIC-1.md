# BUG-ANTHROPIC-1: Claude `setup-token` missing `user:profile` OAuth scope

| Field | Detail |
|---|---|
| **Upstream issue** | [anthropics/claude-code#11985](https://github.com/anthropics/claude-code/issues/11985) |
| **Provider** | Anthropic (Claude Code CLI) |
| **Affected feature** | Usage limits — Claude usage widget |
| **Summary** | The `/api/oauth/usage` endpoint requires the `user:profile` OAuth scope. Tokens provisioned via `claude setup-token` only grant `user:inference`, so the call returns 403. |
| **Workaround** | Run `claude login` interactively to obtain a token with full scopes (but this may invalidate the long-lived automation token). |
| **What needs to happen** | Anthropic adds `user:profile` scope to tokens issued by `claude setup-token`. |
| **Our code** | `src-tauri/src/usage_limits.rs` — `fetch_claude_usage()` detects the 403/scope error and returns a descriptive message instead of raw API JSON. |
| **When fixed upstream** | Remove the special-case 403 detection in `fetch_claude_usage()`; the generic error path is sufficient. |
