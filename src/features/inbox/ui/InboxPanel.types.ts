import type { InboxEvent, InboxFilter } from "../../../entities/inbox-event";

export interface InboxPanelProps {
  events: InboxEvent[];
  filter: InboxFilter;
  loading: boolean;
  error: string | null;
  onFilterChange: (filter: InboxFilter) => void;
  onRefresh: () => Promise<void>;
  onMarkRead: (eventId: number) => Promise<void>;
  onMarkAllRead: () => Promise<void>;
}
