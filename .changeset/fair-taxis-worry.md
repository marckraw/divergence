---
"divergence": minor
---

Add per-session effort settings for Codex and Claude agent conversations. Persist effort alongside model, expose provider- and model-aware effort selection in the agent session header, coerce invalid effort values when the model changes, and pass the selected effort through the Claude CLI and Codex runtime.
