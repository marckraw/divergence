---
"divergence": patch
---

Fix cascade re-check bug in useMergeDetection: stabilize checkDivergence callback by using refs for mergedDivergences, onMergeDetected, and projectsById instead of including them in the dependency array. Previously, each merge detection recreated the callback chain and re-triggered the useEffect, causing unnecessary interval teardown/setup, cleared check state, and potential duplicate merge notifications.
