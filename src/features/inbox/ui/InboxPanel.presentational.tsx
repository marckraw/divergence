import type { InboxFilter } from "../../../entities/inbox-event";
import { Button, EmptyState, ErrorBanner, FilterChipGroup, PanelHeader, PanelToolbar } from "../../../shared";
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
      <PanelHeader
        title="Inbox"
        description="Automation runs and GitHub updates"
        actions={
          <>
            <Button
              type="button"
              onClick={() => {
                void onRefresh();
              }}
              variant="secondary"
              size="sm"
              className="px-3 py-1.5 text-xs rounded border border-surface text-text hover:bg-surface"
              disabled={loading}
            >
              {loading ? "Refreshing..." : "Refresh"}
            </Button>
            <Button
              type="button"
              onClick={() => {
                void onMarkAllRead();
              }}
              variant="secondary"
              size="sm"
              className="px-3 py-1.5 text-xs rounded border border-surface text-text hover:bg-surface"
              disabled={loading || events.length === 0}
            >
              Mark all read
            </Button>
          </>
        }
      />

      <PanelToolbar>
        <FilterChipGroup items={FILTERS} value={filter} onChange={onFilterChange} />
      </PanelToolbar>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4">
        {error && <ErrorBanner className="mb-3">{error}</ErrorBanner>}

        {!error && events.length === 0 && (
          <EmptyState>No inbox events yet.</EmptyState>
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
                  <Button
                    type="button"
                    onClick={() => {
                      void onMarkRead(event.id);
                    }}
                    variant="secondary"
                    size="xs"
                    className="text-[11px] px-2 py-1 rounded border border-surface text-text hover:bg-surface"
                  >
                    Mark read
                  </Button>
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
