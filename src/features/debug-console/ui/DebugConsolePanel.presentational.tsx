import { Button, TextInput, type DebugEvent } from "../../../shared";
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

function DebugConsolePanelPresentational({
  events,
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
  onRefreshTmuxDiagnostics,
  onCopyJson,
  onClear,
}: DebugConsolePanelProps) {
  return (
    <div className="h-full flex flex-col bg-main">
      <div className="px-5 py-4 border-b border-surface flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-text">Debug Console</h2>
          <p className="text-xs text-subtext">
            In-app diagnostics for terminal/tmux stalls. Data is in-memory and clears on restart.
          </p>
        </div>
        <div className="flex items-center gap-2">
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
        </div>
      </div>

      <div className="px-5 py-3 border-b border-surface flex items-center gap-2 text-xs">
        <span className="px-2 py-1 rounded bg-accent/10 text-accent">Info: {infoCount}</span>
        <span className="px-2 py-1 rounded bg-yellow/20 text-yellow">Warn: {warnCount}</span>
        <span className="px-2 py-1 rounded bg-red/20 text-red">Error: {errorCount}</span>
        <span className="ml-auto text-subtext">Visible: {visibleCount} / Total: {totalCount}</span>
      </div>

      <div className="px-5 py-3 border-b border-surface space-y-2">
        <TextInput
          type="text"
          value={searchQuery}
          onChange={(event) => onSearchQueryChange(event.target.value)}
          placeholder="Search message, details, metadata..."
          className="text-xs placeholder:text-subtext/70 focus:ring-1"
        />
        <div className="flex flex-wrap items-center gap-2">
          {LEVEL_FILTER_OPTIONS.map((option) => (
            <Button
              key={option.id}
              type="button"
              onClick={() => onLevelFilterChange(option.id)}
              variant={levelFilter === option.id ? "primary" : "subtle"}
              size="xs"
              className={`px-2.5 py-1 text-xs rounded border ${
                levelFilter === option.id
                  ? "border-accent bg-accent/15 text-accent"
                  : "border-surface text-subtext hover:text-text hover:bg-surface"
              }`}
            >
              {option.label}
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {CATEGORY_FILTER_OPTIONS.map((option) => (
            <Button
              key={option.id}
              type="button"
              onClick={() => onCategoryFilterChange(option.id)}
              variant={categoryFilter === option.id ? "primary" : "subtle"}
              size="xs"
              className={`px-2.5 py-1 text-xs rounded border ${
                categoryFilter === option.id
                  ? "border-accent bg-accent/15 text-accent"
                  : "border-surface text-subtext hover:text-text hover:bg-surface"
              }`}
            >
              {option.label}
            </Button>
          ))}
          <Button
            type="button"
            onClick={onToggleOnlyFailureOrStuck}
            variant={onlyFailureOrStuck ? "danger" : "subtle"}
            size="xs"
            className={`px-2.5 py-1 text-xs rounded border ${
              onlyFailureOrStuck
                ? "border-red/50 bg-red/10 text-red"
                : "border-surface text-subtext hover:text-text hover:bg-surface"
            }`}
          >
            Only failures/stuck
          </Button>
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
      </div>

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
    </div>
  );
}

export default DebugConsolePanelPresentational;
