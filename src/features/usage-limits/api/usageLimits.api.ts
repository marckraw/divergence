import { invoke } from "@tauri-apps/api/core";
import type { CodexUsageResult } from "../model/usageLimits.types";

export function fetchCodexUsage(): Promise<CodexUsageResult> {
  return invoke<CodexUsageResult>("fetch_codex_usage");
}
