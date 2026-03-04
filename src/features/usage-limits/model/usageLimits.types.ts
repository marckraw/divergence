export interface UsageWindow {
  utilization: number;
  resetsAt: string | null;
  label: string;
}

export interface CodexUsageResult {
  available: boolean;
  error: string | null;
  planType: string | null;
  windows: UsageWindow[];
}

export type UsageLevel = "normal" | "warning" | "critical";

export interface UsageLimitsState {
  codex: CodexUsageResult | null;
  loading: boolean;
  lastFetchedAtMs: number | null;
}
