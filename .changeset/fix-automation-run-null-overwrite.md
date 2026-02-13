---
"divergence": patch
---

Fix updateAutomationRun nulling out unrelated fields (startedAtMs, detailsJson) when only updating status or error. Fields omitted by the caller are now preserved instead of being overwritten with null.
