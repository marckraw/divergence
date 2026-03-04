---
"divergence": minor
---

Remove Claude API usage checks from the Usage Limits feature. The Claude usage endpoint consistently returned 429/rate-limit errors and OAuth scope issues. Only Codex usage tracking remains. The `claudeOAuthToken` setting is unchanged and still used by automations and GitHub PR Hub.
