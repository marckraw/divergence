import type {
  ClaudeUsageResult,
  CodexUsageResult,
  UsageLimitsStatus,
} from "../model/usageLimits.types";

export interface UsageLimitsPopoverProps {
  claude: ClaudeUsageResult | null;
  codex: CodexUsageResult | null;
  status: UsageLimitsStatus | null;
  loading: boolean;
  lastFetchedAtMs: number | null;
  onRefresh: () => void;
}
