import {
  Badge,
  Button,
  FilterChipGroup,
  FormModalShell,
  PanelHeader,
  PanelToolbar,
  SearchField,
  type DebugEvent,
} from "../../../shared";
import type { DebugConsolePanelProps } from "./DebugConsolePanel.types";
import type {
  DebugCategoryFilter,
  DebugLevelFilter,
} from "../lib/debugConsole.pure";

const LEVEL_FILTER_OPTIONS: Array<{ id: DebugLevelFilter; label: string }> = [
  { id: "all", label: "All levels" },
  { id: "info", label: "Info" },
  { id: "warn", label: "Warn" },
  { id: "error", label: "Error" },
];

const CATEGORY_FILTER_OPTIONS: Array<{ id: DebugCategoryFilter; label: string }> = [
  { id: "all", label: "All categories" },
  { id: "app", label: "App" },
  { id: "terminal", label: "Terminal" },
  { id: "tmux", label: "Tmux" },
  { id: "automation", label: "Automation" },
  { id: "agent_runtime", label: "Agent Runtime" },
];

const FAILURE_FILTER_OPTIONS = [
  { id: "all", label: "All events" },
  { id: "failures", label: "Only failures/stuck", tone: "danger" as const },
];

function formatTimestamp(atMs: number): string {
  return new Date(atMs).toLocaleString();
}

function getLevelClass(level: DebugEvent["level"]): string {
  if (level === "error") {
    return "bg-red/20 text-red";
  }
  if (level === "warn") {
    return "bg-yellow/20 text-yellow";
  }
  return "bg-accent/20 text-accent";
}

function getCategoryClass(category: DebugEvent["category"]): string {
  if (category === "terminal") {
    return "bg-accent/10 text-accent";
  }
  if (category === "tmux") {
    return "bg-yellow/10 text-yellow";
  }
  if (category === "automation") {
    return "bg-accent/10 text-accent";
  }
  if (category === "agent_runtime") {
    return "bg-accent/10 text-accent";
  }
  return "bg-surface text-text";
}

function renderMetadata(metadata: DebugEvent["metadata"]): string {
  if (!metadata) {
    return "";
  }
  const entries = Object.entries(metadata);
  if (entries.length === 0) {
    return "";
  }
  return entries.map(([key, value]) => `${key}=${String(value)}`).join(" • ");
}

function renderEventJson(event: DebugEvent): string {
  return JSON.stringify(event, null, 2);
}

function DebugConsolePanelPresentational({
  events,
  selectedEvent,
  totalCount,
  visibleCount,
  infoCount,
  warnCount,
  errorCount,
  searchQuery,
  levelFilter,
  categoryFilter,
  onlyFailureOrStuck,
  copyState,
  onSearchQueryChange,
  onLevelFilterChange,
  onCategoryFilterChange,
  onToggleOnlyFailureOrStuck,
  onResetFilters,
  onInspectEvent,
  onCloseInspectModal,
  onRefreshAgentRuntimeSnapshot,
  onRefreshTmuxDiagnostics,
  onCopyJson,
  onClear,
}: DebugConsolePanelProps) {
  return (
    <div className="h-full flex flex-col bg-main">
      <PanelHeader
        title="Debug Console"
        description="In-app diagnostics for terminal/tmux stalls. Data is in-memory and clears on restart."
        actions={(
          <>
          <Button
            type="button"
            onClick={() => {
              void onRefreshAgentRuntimeSnapshot();
            }}
            variant="secondary"
            size="sm"
            className="px-3 py-1.5 text-xs rounded border border-surface text-text hover:bg-surface"
          >
            Capture agent runtime
          </Button>
          <Button
            type="button"
            onClick={() => {
              void onRefreshTmuxDiagnostics();
            }}
            variant="secondary"
            size="sm"
            className="px-3 py-1.5 text-xs rounded border border-surface text-text hover:bg-surface"
          >
            Capture tmux diag
          </Button>
          <Button
            type="button"
            onClick={() => {
              void onCopyJson();
            }}
            variant="secondary"
            size="sm"
            className="px-3 py-1.5 text-xs rounded border border-surface text-text hover:bg-surface"
          >
            {copyState === "copied" ? "Copied" : copyState === "error" ? "Copy failed" : "Copy visible JSON"}
          </Button>
          <Button
            type="button"
            onClick={onClear}
            variant="subtle"
            size="sm"
            className="px-3 py-1.5 text-xs rounded border border-surface text-subtext hover:text-text hover:bg-surface"
            disabled={totalCount === 0}
          >
            Clear
          </Button>
          </>
        )}
      />

      <PanelToolbar>
        <Badge variant="outline" className="border-accent/20 bg-accent/10 text-accent">Info: {infoCount}</Badge>
        <Badge variant="outline" className="border-yellow/30 bg-yellow/20 text-yellow">Warn: {warnCount}</Badge>
        <Badge variant="outline" className="border-red/30 bg-red/20 text-red">Error: {errorCount}</Badge>
        <span className="ml-auto text-subtext">Visible: {visibleCount} / Total: {totalCount}</span>
      </PanelToolbar>

      <PanelToolbar className="flex-col items-stretch">
        <SearchField
          value={searchQuery}
          onChange={onSearchQueryChange}
          onClear={searchQuery ? () => onSearchQueryChange("") : undefined}
          placeholder="Search message, details, metadata..."
          inputClassName="text-xs placeholder:text-subtext/70 focus:ring-1"
        />
        <FilterChipGroup items={LEVEL_FILTER_OPTIONS} value={levelFilter} onChange={onLevelFilterChange} />
        <div className="flex flex-wrap items-center gap-2">
          <FilterChipGroup items={CATEGORY_FILTER_OPTIONS} value={categoryFilter} onChange={onCategoryFilterChange} />
          <FilterChipGroup
            items={FAILURE_FILTER_OPTIONS}
            value={onlyFailureOrStuck ? "failures" : "all"}
            onChange={(value) => {
              if ((value === "failures") !== onlyFailureOrStuck) {
                onToggleOnlyFailureOrStuck();
              }
            }}
          />
          <Button
            type="button"
            onClick={onResetFilters}
            variant="subtle"
            size="xs"
            className="px-2.5 py-1 text-xs rounded border border-surface text-subtext hover:text-text hover:bg-surface"
          >
            Reset filters
          </Button>
        </div>
      </PanelToolbar>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4">
        {events.length === 0 ? (
          <div className="px-3 py-8 text-center text-sm text-subtext">
            {totalCount === 0 ? "No debug events yet." : "No events match the current filters."}
          </div>
        ) : (
          <div className="space-y-2">
            {events.map((event) => {
              const metadataLine = renderMetadata(event.metadata);
              return (
                <div key={event.id} className="rounded-md border border-surface bg-sidebar/50 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm text-text font-medium break-words">{event.message}</div>
                      {event.details && (
                        <div className="mt-1 text-xs text-subtext whitespace-pre-wrap break-words">
                          {event.details}
                        </div>
                      )}
                    </div>
                    <div className="shrink-0 flex items-center gap-2">
                      <Button
                        type="button"
                        onClick={() => onInspectEvent(event)}
                        variant="subtle"
                        size="xs"
                        className="px-2 py-1 text-[11px] rounded border border-surface text-subtext hover:text-text hover:bg-surface"
                      >
                        Inspect
                      </Button>
                      <span className={`text-[10px] uppercase px-1.5 py-0.5 rounded ${getCategoryClass(event.category)}`}>
                        {event.category}
                      </span>
                      <span className={`text-[10px] uppercase px-1.5 py-0.5 rounded ${getLevelClass(event.level)}`}>
                        {event.level}
                      </span>
                    </div>
                  </div>
                  <div className="mt-2 text-[11px] text-subtext flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span>{formatTimestamp(event.atMs)}</span>
                    {metadataLine && (
                      <>
                        <span>•</span>
                        <span className="break-all">{metadataLine}</span>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {selectedEvent && (
        <FormModalShell
          onRequestClose={onCloseInspectModal}
          size="xl"
          surface="sidebar"
          overlayClassName="z-50"
          panelClassName="w-[760px] max-w-[95vw] max-h-[85vh] flex flex-col"
          title="Debug Event Details"
          description={`${selectedEvent.category} • ${selectedEvent.level} • ${formatTimestamp(selectedEvent.atMs)}`}
          scrollableBody
          body={(
            <>
            <section className="space-y-1">
              <h4 className="text-xs font-semibold text-subtext uppercase tracking-wide">Message</h4>
              <div className="text-sm text-text break-words">{selectedEvent.message}</div>
            </section>
            <section className="space-y-1">
              <h4 className="text-xs font-semibold text-subtext uppercase tracking-wide">Details</h4>
              <pre className="text-xs text-subtext whitespace-pre-wrap break-words bg-main border border-surface rounded p-2">
                {selectedEvent.details?.trim() ? selectedEvent.details : "No details"}
              </pre>
            </section>
            <section className="space-y-1">
              <h4 className="text-xs font-semibold text-subtext uppercase tracking-wide">Metadata</h4>
              <pre className="text-xs text-subtext whitespace-pre-wrap break-words bg-main border border-surface rounded p-2">
                {selectedEvent.metadata ? JSON.stringify(selectedEvent.metadata, null, 2) : "No metadata"}
              </pre>
            </section>
            <section className="space-y-1">
              <h4 className="text-xs font-semibold text-subtext uppercase tracking-wide">Raw Event JSON</h4>
              <pre className="text-xs text-subtext whitespace-pre-wrap break-words bg-main border border-surface rounded p-2">
                {renderEventJson(selectedEvent)}
              </pre>
            </section>
            </>
          )}
          footer={(
            <Button
              type="button"
              onClick={onCloseInspectModal}
              variant="secondary"
              size="sm"
            >
              Close
            </Button>
          )}
        />
      )}
    </div>
  );
}

export default DebugConsolePanelPresentational;
