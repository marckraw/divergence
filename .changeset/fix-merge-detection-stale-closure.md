---
"divergence": patch
---

Fix stale closure and cascading re-runs in useMergeDetection. Previously, detecting a merged branch would cause the entire callback chain to recreate, tearing down and re-creating event listeners and intervals, and triggering redundant re-checks that could produce duplicate merge notifications.
