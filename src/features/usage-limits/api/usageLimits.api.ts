import { invoke } from "@tauri-apps/api/core";
import type {
  UsageLimitsStatus,
  ClaudeUsageResult,
  CodexUsageResult,
} from "../model/usageLimits.types";

export function getUsageLimitsStatus(
  claudeOauthToken?: string,
): Promise<UsageLimitsStatus> {
  return invoke<UsageLimitsStatus>("get_usage_limits_status", {
    claudeOauthToken,
  });
}

export function fetchClaudeUsage(
  claudeOauthToken?: string,
): Promise<ClaudeUsageResult> {
  return invoke<ClaudeUsageResult>("fetch_claude_usage", {
    claudeOauthToken,
  });
}

export function fetchCodexUsage(): Promise<CodexUsageResult> {
  return invoke<CodexUsageResult>("fetch_codex_usage");
}
