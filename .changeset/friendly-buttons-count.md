---
"divergence": patch
---

Sanitize Gemini CLI failures before they reach the normal agent conversation UI.

Gemini provider process errors now show concise, actionable user-facing messages instead of dumping raw CLI stderr, stack traces, and local filesystem paths into assistant transcript bubbles. Rate-limit failures include retry guidance when Gemini reports a retry delay, and raw provider diagnostics remain available only in runtime debug details.
