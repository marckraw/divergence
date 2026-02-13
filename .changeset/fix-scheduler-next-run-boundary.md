---
"divergence": patch
---

Fix off-by-one bug in computeNextScheduledRunAtMs: when the computed next run time landed exactly on the current time (or missed intervals aligned to exact multiples), Math.ceil returned 0, causing the function to return the current time instead of a future slot. This could trigger immediate re-runs in a tight loop. Switched to Math.floor + 1 to guarantee the result always lands strictly in the future.
