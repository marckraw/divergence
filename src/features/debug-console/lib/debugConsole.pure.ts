import type { DebugEvent, DebugEventCategory, DebugEventLevel } from "../../../shared";

export type DebugLevelFilter = "all" | DebugEventLevel;
export type DebugCategoryFilter = "all" | DebugEventCategory;

export interface DebugEventFilterInput {
  level: DebugLevelFilter;
  category: DebugCategoryFilter;
  searchQuery: string;
  onlyFailureOrStuck: boolean;
}

const FAILURE_OR_STUCK_KEYWORDS = [
  "stuck",
  "stall",
  "timeout",
  "failed",
  "failure",
  "error",
  "mismatch",
  "reconnect limit",
];

function stringifyEventForSearch(event: DebugEvent): string {
  const metadataEntries = Object.entries(event.metadata ?? {})
    .map(([key, value]) => `${key}=${String(value)}`)
    .join(" ");
  return `${event.message} ${event.details ?? ""} ${metadataEntries}`.toLowerCase();
}

export function isFailureOrStuckEvent(event: DebugEvent): boolean {
  if (event.level === "error") {
    return true;
  }
  const searchable = stringifyEventForSearch(event);
  return FAILURE_OR_STUCK_KEYWORDS.some((keyword) => searchable.includes(keyword));
}

export function eventMatchesSearchQuery(event: DebugEvent, searchQuery: string): boolean {
  const query = searchQuery.trim().toLowerCase();
  if (!query) {
    return true;
  }
  return stringifyEventForSearch(event).includes(query);
}

export function filterDebugEvents(
  events: DebugEvent[],
  filter: DebugEventFilterInput
): DebugEvent[] {
  return events.filter((event) => {
    if (filter.level !== "all" && event.level !== filter.level) {
      return false;
    }
    if (filter.category !== "all" && event.category !== filter.category) {
      return false;
    }
    if (filter.onlyFailureOrStuck && !isFailureOrStuckEvent(event)) {
      return false;
    }
    if (!eventMatchesSearchQuery(event, filter.searchQuery)) {
      return false;
    }
    return true;
  });
}

export function countEventsByLevel(events: DebugEvent[]): {
  info: number;
  warn: number;
  error: number;
} {
  let info = 0;
  let warn = 0;
  let error = 0;

  for (const event of events) {
    if (event.level === "error") {
      error += 1;
    } else if (event.level === "warn") {
      warn += 1;
    } else {
      info += 1;
    }
  }

  return { info, warn, error };
}
