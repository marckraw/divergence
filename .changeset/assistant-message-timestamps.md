---
"divergence": minor
---

Add timestamp display for all assistant messages in the agent session timeline. Shows compact time (HH:MM for today, "Yesterday HH:MM", or "Mon D, HH:MM" for older) next to each message status badge. Timestamps are provider-agnostic, using the existing `createdAtMs` field already set by the Rust agent runtime.
