# Upstream Bug Tracker

This folder tracks known bugs in **upstream dependencies / providers** that affect Divergence. Each bug lives in its own markdown file so agents and humans can discover, update, and clean up entries independently.

## File naming convention

```
BUG-<PROVIDER>-<NUMBER>.md
```

- **PROVIDER** — short uppercase identifier for the upstream project (e.g. `ANTHROPIC`, `OPENAI`, `TAURI`).
- **NUMBER** — sequential integer, unique per provider. Check existing files to pick the next number.

Examples: `BUG-ANTHROPIC-1.md`, `BUG-TAURI-3.md`, `BUG-OPENAI-2.md`.

## Template for new bug files

Copy the block below into a new file and fill in every field.

```markdown
# BUG-<PROVIDER>-<NUMBER>: <Short title>

| Field | Detail |
|---|---|
| **Upstream issue** | [org/repo#N](https://github.com/org/repo/issues/N) |
| **Provider** | Provider name |
| **Affected feature** | Which Divergence feature is impacted |
| **Summary** | One-paragraph description of the bug and how it manifests |
| **Workaround** | What we do today to mitigate (or "None") |
| **What needs to happen** | What the upstream project must fix |
| **Our code** | File path(s) and function(s) where the workaround lives |
| **When fixed upstream** | Steps to remove our workaround once the upstream fix lands |
```

## Guidelines for agents

1. **Before creating a new entry** — scan existing files to make sure the bug isn't already tracked.
2. **One bug per file** — don't combine unrelated issues.
3. **Keep it factual** — link to the upstream issue, describe impact, list workaround. No speculation.
4. **Check periodically** — when working on a related feature, check if the upstream issue has been resolved. If fixed, remove the workaround from our code and delete the bug file.
