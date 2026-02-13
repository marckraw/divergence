---
"divergence": patch
---

Fix updateAutomationRun silently nulling out omitted optional fields (e.g. startedAtMs) when only a subset of fields is provided by the caller.
