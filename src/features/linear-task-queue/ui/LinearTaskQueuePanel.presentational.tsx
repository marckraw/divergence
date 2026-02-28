import type { LinearProjectIssue } from "../../../shared";
import {
  Button,
  EmptyState,
  ErrorBanner,
} from "../../../shared";
import { truncateLinearIssueDescription } from "../lib/linearTaskQueue.pure";

export interface LinearTaskQueuePanelProps {
  projectName: string | null;
  items: LinearProjectIssue[];
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  infoMessage: string | null;
  sendingItemId: string | null;
  onRefresh: () => Promise<void>;
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
  loading,
  refreshing,
  error,
  infoMessage,
  sendingItemId,
  onRefresh,
  onSendItem,
}: LinearTaskQueuePanelProps) {
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
          <span className="text-xs text-subtext">{items.length} tasks</span>
        </div>

        {error && <ErrorBanner>{error}</ErrorBanner>}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-3">
        {loading ? (
          <p className="text-xs text-subtext">Loading Linear tasks...</p>
        ) : items.length === 0 ? (
          <EmptyState bordered className="bg-main/40">
            {infoMessage ?? "No tasks available."}
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
                    <span className="text-[11px] uppercase tracking-wide text-subtext">{issue.identifier}</span>
                    {issue.stateName && (
                      <span className="text-[11px] rounded border border-surface px-1.5 py-0.5 text-subtext">
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
