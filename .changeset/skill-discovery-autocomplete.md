---
"divergence": minor
---

Add skill discovery and slash command autocomplete to agent session composer. Scans Claude Code commands/skills directories and Codex skills directories (both global and project-level) to build a unified skill catalog. Typing `/` in the composer triggers an autocomplete dropdown showing matching skills with keyboard navigation. Claude Code Skill tool invocations are now tracked as distinct "skill" activities in the agent timeline with dedicated grouping and summaries.
