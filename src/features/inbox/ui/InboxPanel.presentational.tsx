import type { InboxFilter } from "../../../entities/inbox-event";
import type { InboxPanelProps } from "./InboxPanel.types";

const FILTERS: Array<{ id: InboxFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "unread", label: "Unread" },
  { id: "automation", label: "Automations" },
  { id: "github", label: "GitHub" },
];

function formatEventTime(createdAtMs: number): string {
  const date = new Date(createdAtMs);
  return date.toLocaleString();
}

function InboxPanelPresentational({
  events,
  filter,
  loading,
  error,
  onFilterChange,
  onRefresh,
  onMarkRead,
  onMarkAllRead,
}: InboxPanelProps) {
  return (
    <div className="h-full flex flex-col bg-main">
      <div className="px-5 py-4 border-b border-surface flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-text">Inbox</h2>
          <p className="text-xs text-subtext">Automation runs and GitHub updates</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              void onRefresh();
            }}
            className="px-3 py-1.5 text-xs rounded border border-surface text-text hover:bg-surface"
            disabled={loading}
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
          <button
            type="button"
            onClick={() => {
              void onMarkAllRead();
            }}
            className="px-3 py-1.5 text-xs rounded border border-surface text-text hover:bg-surface"
            disabled={loading || events.length === 0}
          >
            Mark all read
          </button>
        </div>
      </div>

      <div className="px-5 py-3 border-b border-surface flex items-center gap-2">
        {FILTERS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onFilterChange(item.id)}
            className={`px-2.5 py-1 text-xs rounded ${
              filter === item.id ? "bg-accent text-main" : "bg-surface text-subtext hover:text-text"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4">
        {error && (
          <div className="mb-3 px-3 py-2 rounded border border-red/30 bg-red/10 text-xs text-red">
            {error}
          </div>
        )}

        {!error && events.length === 0 && (
          <div className="px-3 py-8 text-center text-sm text-subtext">
            No inbox events yet.
          </div>
        )}

        <div className="space-y-2">
          {events.map((event) => (
            <div
              key={event.id}
              className={`rounded-md border p-3 ${
                event.read ? "border-surface bg-sidebar/50" : "border-accent/40 bg-accent/5"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm text-text font-medium truncate">{event.title}</div>
                  {event.body && (
                    <div className="text-xs text-subtext mt-1 whitespace-pre-wrap">{event.body}</div>
                  )}
                </div>
                {!event.read && (
                  <button
                    type="button"
                    onClick={() => {
                      void onMarkRead(event.id);
                    }}
                    className="text-[11px] px-2 py-1 rounded border border-surface text-text hover:bg-surface"
                  >
                    Mark read
                  </button>
                )}
              </div>
              <div className="mt-2 text-[11px] text-subtext flex items-center gap-2">
                <span>{event.source}</span>
                <span>•</span>
                <span>{formatEventTime(event.createdAtMs)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default InboxPanelPresentational;
