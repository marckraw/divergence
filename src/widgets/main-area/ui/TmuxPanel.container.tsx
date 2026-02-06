import { useCallback, useMemo, useState } from "react";
import { useTmuxSessions } from "../../../hooks/useTmuxSessions";
import type { Project, Divergence } from "../../../entities";
import {
  filterTmuxSessions,
  getTmuxOwnershipBadge,
} from "../../../lib/utils/tmuxPanel";
import TmuxPanelPresentational from "./TmuxPanel.presentational";

interface TmuxPanelProps {
  projects: Project[];
  divergencesByProject: Map<number, Divergence[]>;
  projectsLoading: boolean;
  divergencesLoading: boolean;
}

function TmuxPanel({
  projects,
  divergencesByProject,
  projectsLoading,
  divergencesLoading,
}: TmuxPanelProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const ownershipReady = !projectsLoading && !divergencesLoading;
  const {
    sessions,
    loading,
    error,
    orphanCount,
    refresh,
    killSession,
    killOrphans,
    killAll,
  } = useTmuxSessions(projects, divergencesByProject, ownershipReady);
  const filteredSessions = useMemo(() => {
    return filterTmuxSessions(sessions, searchQuery);
  }, [sessions, searchQuery]);
  const isFiltering = searchQuery.trim().length > 0;

  const handleKillOrphans = useCallback(() => {
    if (!ownershipReady) return;
    if (!window.confirm(`Kill ${orphanCount} orphan session(s)?`)) return;
    killOrphans();
  }, [orphanCount, killOrphans, ownershipReady]);

  const handleKillAll = useCallback(() => {
    if (!window.confirm(`Kill all ${sessions.length} session(s)?`)) return;
    killAll();
  }, [sessions.length, killAll]);

  return (
    <TmuxPanelPresentational>
      <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b border-surface">
        <div className="flex items-center justify-between px-3 py-2">
          <div className="text-xs uppercase text-subtext font-medium">
            Tmux Sessions
          </div>
          <button
            type="button"
            className="text-xs text-subtext hover:text-text"
            onClick={refresh}
            disabled={loading}
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
        <div className="px-3 pb-2">
          <div className="flex items-center gap-2 bg-main px-3 py-2 rounded">
            <svg
              className="w-4 h-4 text-subtext"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  setSearchQuery("");
                  event.currentTarget.blur();
                }
              }}
              placeholder="Search sessions..."
              className="flex-1 bg-transparent text-text placeholder-subtext focus:outline-none text-xs"
              aria-label="Search tmux sessions"
            />
            {searchQuery && (
              <button
                type="button"
                className="text-subtext hover:text-text"
                onClick={() => setSearchQuery("")}
                title="Clear search"
                aria-label="Clear search"
              >
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Summary bar */}
      {sessions.length > 0 && (
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-surface text-[10px] text-subtext">
          <span>
            {isFiltering
              ? `${filteredSessions.length} of ${sessions.length} session${
                  sessions.length !== 1 ? "s" : ""
                }`
              : `${sessions.length} session${sessions.length !== 1 ? "s" : ""}`}
            {!ownershipReady && (
              <span className="text-subtext/70"> · checking ownership…</span>
            )}
            {ownershipReady && orphanCount > 0 && (
              <span className="text-yellow">
                {" "}
                &middot; {orphanCount} orphan{orphanCount !== 1 ? "s" : ""}
              </span>
            )}
          </span>
          <div className="flex items-center gap-2">
            {ownershipReady && orphanCount > 0 && (
              <button
                type="button"
                className="text-yellow hover:text-text transition-colors"
                onClick={handleKillOrphans}
                disabled={loading}
              >
                Kill Orphans
              </button>
            )}
            <button
              type="button"
              className="text-subtext hover:text-red transition-colors"
              onClick={handleKillAll}
              disabled={loading || !ownershipReady}
            >
              Kill All
            </button>
          </div>
        </div>
      )}

      {/* Session list */}
      <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-1">
        {error && (
          <div className="px-2 py-2 text-xs text-red bg-red/10 border border-red/30 rounded">
            {error}
          </div>
        )}

        {!error && loading && sessions.length === 0 && (
          <div className="px-2 py-8 text-center text-xs text-subtext">
            Loading...
          </div>
        )}

        {!error && !loading && sessions.length === 0 && (
          <div className="px-2 py-8 text-center text-xs text-subtext">
            No tmux sessions running.
          </div>
        )}

        {!error && !loading && sessions.length > 0 && filteredSessions.length === 0 && isFiltering && (
          <div className="px-2 py-8 text-center text-xs text-subtext">
            No sessions match "{searchQuery}"
          </div>
        )}

        {filteredSessions.map((session) => {
          const badge = getTmuxOwnershipBadge(session);
          return (
            <div
              key={session.name}
              className="group w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-surface/50 transition-colors"
            >
              {/* Status dot */}
              <div
                className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  session.attached ? "bg-green" : "bg-subtext/40"
                }`}
                title={session.attached ? "Attached" : "Detached"}
              />

              {/* Name + ownership */}
              <div className="flex-1 min-w-0">
                <div className="text-xs text-text truncate">{session.name}</div>
                <div className="flex items-center gap-1 mt-0.5">
                  <span
                    className={`text-[10px] px-1 rounded ${badge.className}`}
                  >
                    {badge.text}
                  </span>
                  <span className="text-[10px] text-subtext/70 px-1 rounded bg-surface">
                    {session.attached ? "attached" : "detached"}
                  </span>
                </div>
              </div>

              {/* Kill button */}
              <button
                type="button"
                className="w-5 h-5 flex items-center justify-center text-subtext hover:text-red opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                onClick={() => killSession(session.name)}
                title="Kill session"
                disabled={loading}
              >
                <svg
                  className="w-3 h-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          );
        })}
      </div>
      </div>
    </TmuxPanelPresentational>
  );
}

export default TmuxPanel;
