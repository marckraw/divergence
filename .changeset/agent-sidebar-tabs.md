---
"divergence": minor
---

Add tabbed sidebar to agent session view with Changes, Linear, and Queue tabs. Linear tab fetches project issues from Linear API and populates the agent composer with a formatted prompt on send. Queue tab manages pre-drafted prompts scoped to the session's project or workspace. Both tabs inject text into the agent composer via an imperative ref, letting the user review before sending.
