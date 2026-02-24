import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  recordDebugEvent,
  type DebugEvent,
  useDebugEvents,
} from "../../../shared";
import { getTmuxDiagnostics } from "../../../shared/api/tmuxSessions.api";
import {
  countEventsByLevel,
  filterDebugEvents,
  type DebugCategoryFilter,
  type DebugLevelFilter,
} from "../lib/debugConsole.pure";
import DebugConsolePanelPresentational from "./DebugConsolePanel.presentational";

const COPY_STATUS_RESET_MS = 1500;

function buildTmuxDiagnosticsDetails(): Promise<string> {
  return getTmuxDiagnostics().then((diag) => {
    const tmuxVersion = diag.version.stdout.trim() || diag.version.error || "unknown";
    const listSessionsErr = diag.list_sessions_raw.stderr.trim() || diag.list_sessions_raw.error || "none";
    const tmpdirMismatch = Boolean(
      diag.env_tmpdir
      && diag.login_shell_tmpdir
      && diag.env_tmpdir !== diag.login_shell_tmpdir
    );
    return [
      `tmux_path=${diag.resolved_tmux_path ?? "NOT FOUND"}`,
      `login_shell_tmux_path=${diag.login_shell_tmux_path ?? "unresolved"}`,
      `tmux_version=${tmuxVersion}`,
      `list_sessions_exit=${diag.list_sessions_raw.status_code ?? "N/A"}`,
      `list_sessions_stderr=${listSessionsErr}`,
      `tmpdir_mismatch=${tmpdirMismatch ? "yes" : "no"}`,
      `env_tmpdir=${diag.env_tmpdir ?? "UNSET"}`,
      `login_tmpdir=${diag.login_shell_tmpdir ?? "UNSET"}`,
      `env_tmux_tmpdir=${diag.env_tmux_tmpdir ?? "unset"}`,
      `login_tmux_tmpdir=${diag.login_shell_tmux_tmpdir ?? "unset"}`,
    ].join("\n");
  });
}

function DebugConsolePanelContainer() {
  const {
    events,
    clear,
  } = useDebugEvents();
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");
  const [searchQuery, setSearchQuery] = useState("");
  const [levelFilter, setLevelFilter] = useState<DebugLevelFilter>("all");
  const [categoryFilter, setCategoryFilter] = useState<DebugCategoryFilter>("all");
  const [onlyFailureOrStuck, setOnlyFailureOrStuck] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const copyResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copyResetTimerRef.current) {
        clearTimeout(copyResetTimerRef.current);
        copyResetTimerRef.current = null;
      }
    };
  }, []);

  const orderedEvents = useMemo(
    () => [...events].sort((a, b) => b.atMs - a.atMs),
    [events]
  );
  const filteredEvents = useMemo(() => {
    return filterDebugEvents(orderedEvents, {
      level: levelFilter,
      category: categoryFilter,
      searchQuery,
      onlyFailureOrStuck,
    });
  }, [categoryFilter, levelFilter, onlyFailureOrStuck, orderedEvents, searchQuery]);
  const visibleCounts = useMemo(() => countEventsByLevel(filteredEvents), [filteredEvents]);
  const totalCount = orderedEvents.length;
  const visibleCount = filteredEvents.length;
  const selectedEvent = useMemo(
    () => orderedEvents.find((event) => event.id === selectedEventId) ?? null,
    [orderedEvents, selectedEventId],
  );

  const handleRefreshTmuxDiagnostics = useCallback(async () => {
    try {
      const details = await buildTmuxDiagnosticsDetails();
      recordDebugEvent({
        level: "info",
        category: "tmux",
        message: "Manual tmux diagnostics captured",
        details,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      recordDebugEvent({
        level: "error",
        category: "tmux",
        message: "Manual tmux diagnostics failed",
        details: message,
      });
    }
  }, []);

  const handleCopyJson = useCallback(async () => {
    const payload = JSON.stringify(filteredEvents, null, 2);
    try {
      await navigator.clipboard.writeText(payload);
      setCopyState("copied");
    } catch {
      setCopyState("error");
    }
    if (copyResetTimerRef.current) {
      clearTimeout(copyResetTimerRef.current);
    }
    copyResetTimerRef.current = setTimeout(() => {
      setCopyState("idle");
      copyResetTimerRef.current = null;
    }, COPY_STATUS_RESET_MS);
  }, [filteredEvents]);

  const handleResetFilters = useCallback(() => {
    setSearchQuery("");
    setLevelFilter("all");
    setCategoryFilter("all");
    setOnlyFailureOrStuck(false);
  }, []);

  const handleInspectEvent = useCallback((event: DebugEvent) => {
    setSelectedEventId(event.id);
  }, []);

  const handleCloseInspectModal = useCallback(() => {
    setSelectedEventId(null);
  }, []);

  const handleClear = useCallback(() => {
    setSelectedEventId(null);
    clear();
  }, [clear]);

  return (
    <DebugConsolePanelPresentational
      events={filteredEvents}
      selectedEvent={selectedEvent}
      totalCount={totalCount}
      visibleCount={visibleCount}
      infoCount={visibleCounts.info}
      warnCount={visibleCounts.warn}
      errorCount={visibleCounts.error}
      searchQuery={searchQuery}
      levelFilter={levelFilter}
      categoryFilter={categoryFilter}
      onlyFailureOrStuck={onlyFailureOrStuck}
      copyState={copyState}
      onSearchQueryChange={setSearchQuery}
      onLevelFilterChange={setLevelFilter}
      onCategoryFilterChange={setCategoryFilter}
      onToggleOnlyFailureOrStuck={() => setOnlyFailureOrStuck((current) => !current)}
      onResetFilters={handleResetFilters}
      onInspectEvent={handleInspectEvent}
      onCloseInspectModal={handleCloseInspectModal}
      onRefreshTmuxDiagnostics={handleRefreshTmuxDiagnostics}
      onCopyJson={handleCopyJson}
      onClear={handleClear}
    />
  );
}

export default DebugConsolePanelContainer;
