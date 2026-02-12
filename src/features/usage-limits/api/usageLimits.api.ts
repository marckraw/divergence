import { invoke } from "@tauri-apps/api/core";
import type {
  UsageLimitsStatus,
  ClaudeUsageResult,
  CodexUsageResult,
} from "../model/usageLimits.types";

export function getUsageLimitsStatus(): Promise<UsageLimitsStatus> {
  return invoke<UsageLimitsStatus>("get_usage_limits_status");
}

export function fetchClaudeUsage(): Promise<ClaudeUsageResult> {
  return invoke<ClaudeUsageResult>("fetch_claude_usage");
}

export function fetchCodexUsage(): Promise<CodexUsageResult> {
  return invoke<CodexUsageResult>("fetch_codex_usage");
}
