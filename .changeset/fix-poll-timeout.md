---
"divergence": patch
---

Fix infinite loop in automation polling: add 4-hour maximum timeout to pollUntilDone to prevent stuck automation runs from blocking the task queue indefinitely. Also fix DB finalization so timed-out runs are correctly marked as "error" instead of remaining in "running" status.
