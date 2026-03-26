import {
  Button,
  EmptyState,
  ErrorBanner,
  FilterChipGroup,
  LoadingSpinner,
  PanelToolbar,
  SearchField,
} from "../../../shared";
import type { LinearWorkflowState } from "../../../shared";
import {
  getLinearIssueStatusToneClass,
  getLinearWorkflowStateToneClass,
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
  workflowStates: LinearWorkflowState[];
  updatingIssueId: string | null;
  statePickerOpenIssueId: string | null;
  onToggleStatePicker: (issueId: string | null) => void;
  onRefresh: () => Promise<void>;
  onStatusFilterChange: (filter: LinearIssueStatusFilter) => void;
  onSearchQueryChange: (query: string) => void;
  onSendItem: (issueId: string) => Promise<void>;
  onUpdateIssueState: (issueId: string, stateId: string) => Promise<void>;
}

function StatePickerDropdown({
  issueId,
  currentStateName,
  currentStateType,
  workflowStates,
  updating,
  isOpen,
  onToggle,
  onUpdateIssueState,
}: {
  issueId: string;
  currentStateName: string | null;
  currentStateType: string | null;
  workflowStates: LinearWorkflowState[];
  updating: boolean;
  isOpen: boolean;
  onToggle: (issueId: string | null) => void;
  onUpdateIssueState: (issueId: string, stateId: string) => Promise<void>;
}) {
  const toneClass = currentStateType
    ? getLinearIssueStatusToneClass({ stateType: currentStateType })
    : "border-surface text-subtext bg-main/30";

  return (
    <div className="relative">
      <Button
        type="button"
        variant="subtle"
        size="xs"
        className={`text-[11px] rounded border px-1.5 py-0.5 cursor-pointer hover:brightness-110 transition-all ${toneClass}`}
        onClick={() => {
          if (!updating) {
            onToggle(isOpen ? null : issueId);
          }
        }}
        disabled={updating}
      >
        {updating ? (
          <span className="flex items-center gap-1">
            <LoadingSpinner className="w-3 h-3" />
            {currentStateName ?? "Unknown"}
          </span>
        ) : (
          currentStateName ?? "Unknown"
        )}
      </Button>
      {isOpen && workflowStates.length > 0 && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => onToggle(null)}
          />
          <div className="absolute right-0 top-full mt-1 z-50 min-w-[160px] max-h-[240px] overflow-y-auto rounded-md border border-surface bg-sidebar shadow-lg py-1">
            {workflowStates.map((state) => {
              const isCurrentState = state.name === currentStateName;
              const optionToneClass = getLinearWorkflowStateToneClass(state.stateType);
              return (
                <Button
                  key={state.id}
                  type="button"
                  variant="subtle"
                  size="xs"
                  className={`w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 hover:bg-surface/60 transition-colors ${
                    isCurrentState ? "font-semibold" : ""
                  }`}
                  onClick={() => {
                    onToggle(null);
                    if (!isCurrentState) {
                      void onUpdateIssueState(issueId, state.id);
                    }
                  }}
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: state.color }}
                  />
                  <span className={`rounded border px-1.5 py-0.5 ${optionToneClass}`}>
                    {state.name}
                  </span>
                  {isCurrentState && (
                    <svg className="w-3 h-3 ml-auto text-accent shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </Button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
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
  workflowStates,
  updatingIssueId,
  statePickerOpenIssueId,
  onToggleStatePicker,
  onRefresh,
  onStatusFilterChange,
  onSearchQueryChange,
  onSendItem,
  onUpdateIssueState,
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
                : "Fetch project issues and send one as a prompt."}
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

        <PanelToolbar className="px-0 py-0 border-b-0">
          <SearchField
            value={searchQuery}
            onChange={onSearchQueryChange}
            placeholder="Search identifier, title, description, assignee, state..."
            inputClassName="text-xs"
          />
          <FilterChipGroup items={STATUS_FILTER_OPTIONS} value={statusFilter} onChange={onStatusFilterChange} />
        </PanelToolbar>

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
                      <StatePickerDropdown
                        issueId={issue.id}
                        currentStateName={issue.stateName}
                        currentStateType={issue.stateType}
                        workflowStates={workflowStates}
                        updating={updatingIssueId === issue.id}
                        isOpen={statePickerOpenIssueId === issue.id}
                        onToggle={onToggleStatePicker}
                        onUpdateIssueState={onUpdateIssueState}
                      />
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
