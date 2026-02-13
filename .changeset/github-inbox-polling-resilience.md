---
"divergence": patch
---

Fix GitHub inbox polling failure cascade where a single insertInboxEvent error would abort processing of all remaining pull requests and repositories, and prevent poll state from being updated.
