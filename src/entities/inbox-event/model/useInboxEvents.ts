import { useCallback, useEffect, useMemo, useState } from "react";
import {
  countUnreadInboxEvents,
  listInboxEvents,
  markAllInboxEventsRead,
  markInboxEventRead,
} from "../api/inboxEvent.api";
import type { InboxEvent, InboxFilter } from "./inboxEvent.types";

interface UseInboxEventsResult {
  events: InboxEvent[];
  filter: InboxFilter;
  unreadCount: number;
  loading: boolean;
  error: string | null;
  setFilter: (filter: InboxFilter) => void;
  refresh: () => Promise<void>;
  markRead: (eventId: number) => Promise<void>;
  markAllRead: () => Promise<void>;
}

export function useInboxEvents(initialFilter: InboxFilter = "all"): UseInboxEventsResult {
  const [events, setEvents] = useState<InboxEvent[]>([]);
  const [filter, setFilter] = useState<InboxFilter>(initialFilter);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const [rows, unread] = await Promise.all([
        listInboxEvents(filter),
        countUnreadInboxEvents(),
      ]);
      setEvents(rows);
      setUnreadCount(unread);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load inbox");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const markRead = useCallback(async (eventId: number) => {
    await markInboxEventRead(eventId);
    await refresh();
  }, [refresh]);

  const markAllRead = useCallback(async () => {
    await markAllInboxEventsRead();
    await refresh();
  }, [refresh]);

  const visibleUnreadCount = useMemo(() => {
    return events.reduce((count, event) => count + (event.read ? 0 : 1), 0);
  }, [events]);

  return {
    events,
    filter,
    unreadCount: filter === "unread" ? visibleUnreadCount : unreadCount,
    loading,
    error,
    setFilter,
    refresh,
    markRead,
    markAllRead,
  };
}
