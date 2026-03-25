---
"divergence": patch
---

Bound editor file loads so hung reads surface a retry instead of leaving the spinner stuck forever.

Editor sessions now time out stalled file reads, ignore stale load results after retries or closes, preserve already-loaded content on reload failures, and show a retry action when a file load fails.
