import type {
  UsageLevel,
  UsageWindow,
  CodexUsageResult,
} from "./usageLimits.types";

export function formatUtilization(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export function formatResetTime(isoString: string | null): string {
  if (!isoString) return "";

  const resetDate = new Date(isoString);
  const now = Date.now();
  const diffMs = resetDate.getTime() - now;

  if (diffMs <= 0) return "now";

  const totalMinutes = Math.floor(diffMs / 60_000);
  const totalHours = Math.floor(totalMinutes / 60);
  const totalDays = Math.floor(totalHours / 24);

  if (totalDays > 0) {
    const remainingHours = totalHours % 24;
    return remainingHours > 0
      ? `${totalDays}d ${remainingHours}h`
      : `${totalDays}d`;
  }

  if (totalHours > 0) {
    const remainingMinutes = totalMinutes % 60;
    return remainingMinutes > 0
      ? `${totalHours}h ${remainingMinutes}m`
      : `${totalHours}h`;
  }

  return `${totalMinutes}m`;
}

export function getUsageLevel(utilization: number): UsageLevel {
  if (utilization >= 0.8) return "critical";
  if (utilization >= 0.5) return "warning";
  return "normal";
}

export function getUsageLevelColor(level: UsageLevel): string {
  switch (level) {
    case "critical":
      return "bg-red";
    case "warning":
      return "bg-yellow";
    case "normal":
      return "bg-green";
  }
}

export function getUsageLevelBarColor(level: UsageLevel): string {
  switch (level) {
    case "critical":
      return "bg-red";
    case "warning":
      return "bg-yellow";
    case "normal":
      return "bg-accent";
  }
}

export function getSummaryUsageLevel(
  codex: CodexUsageResult | null,
): UsageLevel {
  const allWindows: UsageWindow[] = codex?.windows ?? [];

  if (allWindows.length === 0) return "normal";

  const maxUtilization = Math.max(...allWindows.map((w) => w.utilization));
  return getUsageLevel(maxUtilization);
}

export function formatTimeSince(timestampMs: number | null): string {
  if (!timestampMs) return "never";

  const diffMs = Date.now() - timestampMs;
  const seconds = Math.floor(diffMs / 1000);

  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;

  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ago`;
}
