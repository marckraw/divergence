import {
  Button,
  EmptyState,
  ErrorBanner,
  TextInput,
} from "../../../shared";
import {
  getLinearIssueStatusToneClass,
  truncateLinearIssueDescription,
} from "../lib/linearTaskQueue.pure";
import type { LinearIssueStatusFilter, LinearTaskQueueIssue } from "../lib/linearTaskQueue.pure";

const STATUS_FILTER_OPTIONS: Array<{ id: LinearIssueStatusFilter; label: string }> = [
  { id: "open", label: "Open" },
  { id: "all", label: "All" },
  { id: "todo_in_progress", label: "Todo + In Progress" },
  { id: "todo", label: "Todo" },
  { id: "in_progress", label: "In Progress" },
  { id: "completed", label: "Completed" },
  { id: "canceled", label: "Canceled" },
];

export interface LinearTaskQueuePanelProps {
  projectName: string | null;
  items: LinearTaskQueueIssue[];
  totalCount: number;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  infoMessage: string | null;
  sendingItemId: string | null;
  statusFilter: LinearIssueStatusFilter;
  searchQuery: string;
  onRefresh: () => Promise<void>;
  onStatusFilterChange: (filter: LinearIssueStatusFilter) => void;
  onSearchQueryChange: (query: string) => void;
  onSendItem: (issueId: string) => Promise<void>;
}

function formatUpdatedAt(updatedAtMs: number | null): string {
  if (!updatedAtMs || Number.isNaN(updatedAtMs)) {
    return "Updated recently";
  }

  return new Date(updatedAtMs).toLocaleString();
}

function LinearTaskQueuePanel({
  projectName,
  items,
  totalCount,
  loading,
  refreshing,
  error,
  infoMessage,
  sendingItemId,
  statusFilter,
  searchQuery,
  onRefresh,
  onStatusFilterChange,
  onSearchQueryChange,
  onSendItem,
}: LinearTaskQueuePanelProps) {
  const hasFilterOrSearch = statusFilter !== "open" || searchQuery.trim().length > 0;

  return (
    <div className="h-full flex flex-col bg-sidebar">
      <div className="p-3 border-b border-surface space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-text">Linear Tasks</h3>
            <p className="text-xs text-subtext">
              {projectName
                ? `Fetched from ${projectName}`
                : "Fetch project issues and send one as a prompt to this terminal."}
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            disabled={loading || refreshing}
            onClick={() => {
              void onRefresh();
            }}
          >
            {refreshing ? "Refreshing..." : "Refresh"}
          </Button>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs text-subtext">
            {hasFilterOrSearch
              ? `${items.length} of ${totalCount} tasks`
              : `${totalCount} tasks`}
          </span>
        </div>

        <TextInput
          type="text"
          value={searchQuery}
          onChange={(event) => onSearchQueryChange(event.target.value)}
          placeholder="Search identifier, title, description, assignee, state..."
          className="text-xs"
        />
        <div className="flex flex-wrap items-center gap-2">
          {STATUS_FILTER_OPTIONS.map((option) => (
            <Button
              key={option.id}
              type="button"
              onClick={() => onStatusFilterChange(option.id)}
              variant={statusFilter === option.id ? "primary" : "subtle"}
              size="xs"
              className={`px-2.5 py-1 text-xs rounded border ${
                statusFilter === option.id
                  ? "border-accent bg-accent/15 text-accent"
                  : "border-surface text-subtext hover:text-text hover:bg-surface"
              }`}
            >
              {option.label}
            </Button>
          ))}
        </div>

        {error && <ErrorBanner>{error}</ErrorBanner>}
        {infoMessage && (
          <div
            role="status"
            className="px-3 py-2 rounded border border-surface bg-main/40 text-xs text-subtext"
          >
            {infoMessage}
          </div>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-3">
        {loading ? (
          <p className="text-xs text-subtext">Loading Linear tasks...</p>
        ) : items.length === 0 ? (
          <EmptyState bordered className="bg-main/40">
            No tasks available.
          </EmptyState>
        ) : (
          <div className="space-y-2">
            {items.map((issue) => {
              const isSending = sendingItemId === issue.id;
              const description = truncateLinearIssueDescription(issue.description);
              return (
                <div
                  key={issue.id}
                  className="rounded-md border border-surface bg-main/40 p-3 space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[11px] uppercase tracking-wide text-subtext shrink-0">
                        {issue.identifier}
                      </span>
                      {issue.sourceProjectName && (
                        <span
                          className="text-[11px] rounded border border-surface px-1.5 py-0.5 text-subtext truncate"
                          title={issue.sourceProjectPath ?? issue.sourceProjectName}
                        >
                          {issue.sourceProjectName}
                        </span>
                      )}
                    </div>
                    {issue.stateName && (
                      <span className={`text-[11px] rounded border px-1.5 py-0.5 ${getLinearIssueStatusToneClass(issue)}`}>
                        {issue.stateName}
                      </span>
                    )}
                  </div>

                  <p className="text-sm text-text font-medium leading-snug">{issue.title}</p>

                  {description && (
                    <p className="text-xs text-subtext whitespace-pre-wrap break-words">
                      {description}
                    </p>
                  )}

                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] text-subtext">
                      {issue.assigneeName ? `Assignee: ${issue.assigneeName} - ` : ""}
                      {formatUpdatedAt(issue.updatedAtMs)}
                    </span>
                    <div className="flex items-center gap-2">
                      {issue.url && (
                        <a
                          href={issue.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-accent hover:underline"
                        >
                          Open
                        </a>
                      )}
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={isSending}
                        onClick={() => {
                          void onSendItem(issue.id);
                        }}
                      >
                        {isSending ? "Sending..." : "Send"}
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default LinearTaskQueuePanel;
