---
"divergence": patch
---

Fix MCP tool calls falsely showing ERROR badges in the Codex provider. The error status check used `is_some()` which treated JSON `null` error fields as actual errors, causing all MCP tool activities to appear failed even when they returned valid results. Also add missing approval handler for `item/mcpToolCall/requestApproval` to prevent potential hangs when Codex requests MCP tool approval.
