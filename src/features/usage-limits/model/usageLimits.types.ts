export interface UsageWindow {
  utilization: number;
  resetsAt: string | null;
  label: string;
}

export interface UsageLimitsStatus {
  claudeCredentialsFound: boolean;
  codexCredentialsFound: boolean;
}

export interface ClaudeUsageResult {
  available: boolean;
  error: string | null;
  windows: UsageWindow[];
}

export interface CodexUsageResult {
  available: boolean;
  error: string | null;
  planType: string | null;
  windows: UsageWindow[];
}

export type UsageLevel = "normal" | "warning" | "critical";

export interface UsageLimitsState {
  claude: ClaudeUsageResult | null;
  codex: CodexUsageResult | null;
  status: UsageLimitsStatus | null;
  loading: boolean;
  lastFetchedAtMs: number | null;
}
