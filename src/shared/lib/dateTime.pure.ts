/**
 * Format a millisecond timestamp as a compact time string for display in chat bubbles.
 *
 * Shows "HH:MM" for today, "Yesterday HH:MM" for yesterday, or "MMM D, HH:MM" for older.
 */
export function formatMessageTime(ms: number | null | undefined): string {
  if (!ms) {
    return "";
  }

  const date = new Date(ms);
  const now = new Date();
  const time = date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });

  const isToday =
    date.getFullYear() === now.getFullYear()
    && date.getMonth() === now.getMonth()
    && date.getDate() === now.getDate();
  if (isToday) {
    return time;
  }

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday =
    date.getFullYear() === yesterday.getFullYear()
    && date.getMonth() === yesterday.getMonth()
    && date.getDate() === yesterday.getDate();
  if (isYesterday) {
    return `Yesterday ${time}`;
  }

  const monthDay = date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return `${monthDay}, ${time}`;
}

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
