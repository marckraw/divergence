---
"divergence": patch
---

Improve architecture and hygiene enforcement across the app and backend.

- Enforce stricter Chaperone rules for import boundaries and pure-file behavior.
- Migrate naming/placement to align with FSD conventions (`*.pure.ts`, `*.api.ts`, `*.service.ts`, and shared public API usage).
- Refactor presentational/container boundaries where needed.
- Harden Rust backend error handling (remove panic-prone `expect` paths).
- Improve Rust helper structure and reduce path conversion duplication.
- Add missing unit-test coverage for quick edit import extension exports.
