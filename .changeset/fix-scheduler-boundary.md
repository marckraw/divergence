---
"divergence": patch
---

Fix automation scheduler boundary case where `computeNextScheduledRunAtMs` could return a time equal to the current time, causing immediate re-triggering in a tight loop
