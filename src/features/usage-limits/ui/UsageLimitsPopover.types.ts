import type { CodexUsageResult } from "../model/usageLimits.types";

export interface UsageLimitsPopoverProps {
  codex: CodexUsageResult | null;
  loading: boolean;
  lastFetchedAtMs: number | null;
  onRefresh: () => void;
}
