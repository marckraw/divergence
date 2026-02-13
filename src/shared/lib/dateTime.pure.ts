/**
 * Format a millisecond timestamp as a locale string, or return a fallback.
 */
export function formatTimestamp(ms: number | null | undefined, fallback: string): string {
  if (!ms) {
    return fallback;
  }
  return new Date(ms).toLocaleString();
}

/**
 * Format a millisecond timestamp as a human-readable relative age string.
 *
 * Returns strings like "just now", "12s ago", "3m 45s ago", "2h 15m ago", "1d 3h ago".
 */
export function formatRelativeAge(atMs: number | null | undefined, nowMs: number): string {
  if (!atMs) {
    return "unknown";
  }
  const seconds = Math.max(0, Math.floor((nowMs - atMs) / 1000));
  if (seconds < 2) {
    return "just now";
  }
  if (seconds < 60) {
    return `${seconds}s ago`;
  }
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    const remainder = seconds % 60;
    return `${minutes}m ${remainder}s ago`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    const remainderMinutes = minutes % 60;
    return remainderMinutes > 0 ? `${hours}h ${remainderMinutes}m ago` : `${hours}h ago`;
  }
  const days = Math.floor(hours / 24);
  const remainderHours = hours % 24;
  return remainderHours > 0 ? `${days}d ${remainderHours}h ago` : `${days}d ago`;
}
