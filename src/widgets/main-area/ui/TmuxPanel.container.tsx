import { useCallback, useMemo, useState } from "react";
import { useTmuxSessions } from "../../../entities/terminal-session";
import type { Project, Divergence, TerminalSession } from "../../../entities";
import { Button, EmptyState, ErrorBanner, IconButton } from "../../../shared";
import {
  findSessionIdsByTmuxSessionName,
  filterTmuxSessions,
  getTmuxOwnershipBadge,
} from "../lib/tmuxPanel.pure";
import TmuxPanelPresentational from "./TmuxPanel.presentational";

interface TmuxPanelProps {
  projects: Project[];
  divergencesByProject: Map<number, Divergence[]>;
  projectsLoading: boolean;
  divergencesLoading: boolean;
  appSessions: TerminalSession[];
  onCloseSessionAndKillTmux: (sessionId: string) => Promise<void>;
}

function TmuxPanel({
  projects,
  divergencesByProject,
  projectsLoading,
  divergencesLoading,
  appSessions,
  onCloseSessionAndKillTmux,
}: TmuxPanelProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const ownershipReady = !projectsLoading && !divergencesLoading;
  const {
    sessions: tmuxSessions,
    loading,
    error,
    orphanCount,
    diagnostics,
    refresh,
    killSession,
    killOrphans,
    killAll,
  } = useTmuxSessions(projects, divergencesByProject, ownershipReady);
  const filteredSessions = useMemo(() => {
    return filterTmuxSessions(tmuxSessions, searchQuery);
  }, [tmuxSessions, searchQuery]);
  const isFiltering = searchQuery.trim().length > 0;

  const handleKillOrphans = useCallback(() => {
    if (!ownershipReady) return;
    if (!window.confirm(`Kill ${orphanCount} orphan session(s)?`)) return;
    killOrphans();
  }, [orphanCount, killOrphans, ownershipReady]);

  const handleKillAll = useCallback(() => {
    if (!window.confirm(`Kill all ${tmuxSessions.length} session(s)?`)) return;
    killAll();
  }, [tmuxSessions.length, killAll]);

  const handleKillSession = useCallback(async (sessionName: string) => {
    const matchingSessionIds = Array.from(new Set(findSessionIdsByTmuxSessionName(appSessions, sessionName)));
    if (matchingSessionIds.length > 0) {
      for (const sessionId of matchingSessionIds) {
        await onCloseSessionAndKillTmux(sessionId);
      }
      await refresh();
      return;
    }
    await killSession(sessionName);
  }, [appSessions, killSession, onCloseSessionAndKillTmux, refresh]);

  return (
    <TmuxPanelPresentational>
      <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b border-surface">
        <div className="flex items-center justify-between px-3 py-2">
          <div className="text-xs uppercase text-subtext font-medium">
            Tmux Sessions
          </div>
          <Button
            type="button"
            className="text-xs text-subtext hover:text-text"
            onClick={refresh}
            disabled={loading}
            variant="ghost"
            size="xs"
          >
            {loading ? "Refreshing..." : "Refresh"}
          </Button>
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
              <IconButton
                type="button"
                className="text-subtext hover:text-text"
                onClick={() => setSearchQuery("")}
                title="Clear search"
                variant="ghost"
                size="xs"
                label="Clear search"
                icon={(
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
                )}
              />
            )}
          </div>
        </div>
      </div>

      {/* Summary bar */}
      {tmuxSessions.length > 0 && (
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-surface text-[10px] text-subtext">
          <span>
            {isFiltering
              ? `${filteredSessions.length} of ${tmuxSessions.length} session${
                  tmuxSessions.length !== 1 ? "s" : ""
                }`
              : `${tmuxSessions.length} session${tmuxSessions.length !== 1 ? "s" : ""}`}
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
              <Button
                type="button"
                className="text-yellow hover:text-text transition-colors"
                onClick={handleKillOrphans}
                disabled={loading}
                variant="ghost"
                size="xs"
              >
                Kill Orphans
              </Button>
            )}
            <Button
              type="button"
              className="text-subtext hover:text-red transition-colors"
              onClick={handleKillAll}
              disabled={loading || !ownershipReady}
              variant="ghost"
              size="xs"
            >
              Kill All
            </Button>
          </div>
        </div>
      )}

      {/* Session list */}
      <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-1">
        {error && (
          <ErrorBanner className="px-2">{error}</ErrorBanner>
        )}

        {!error && loading && tmuxSessions.length === 0 && (
          <EmptyState className="px-2 text-xs">
            Loading...
          </EmptyState>
        )}

        {!error && !loading && tmuxSessions.length === 0 && (
          <div className="px-2 py-4 text-xs text-subtext space-y-2">
            <div className="py-2 text-center">No tmux sessions running.</div>
            {diagnostics && (
              <div className="text-left">
                <Button
                  type="button"
                  className="text-[10px] text-subtext/70 hover:text-text underline"
                  onClick={() => setShowDiagnostics((v) => !v)}
                  variant="ghost"
                  size="xs"
                >
                  {showDiagnostics ? "Hide diagnostics" : "Show diagnostics"}
                </Button>
                {showDiagnostics && (
                  <div className="mt-2 p-2 bg-surface/50 rounded text-[10px] font-mono space-y-1 overflow-x-auto">
                    <div className="text-text font-semibold mb-1">Tmux Environment</div>
                    <div>tmux binary: <span className="text-text">{diagnostics.resolved_tmux_path ?? "NOT FOUND"}</span></div>
                    <div>tmux version: <span className="text-text">{diagnostics.version.stdout.trim() || diagnostics.version.error || "unknown"}</span></div>
                    <div>login shell tmux: <span className="text-text">{diagnostics.login_shell_tmux_path ?? "unresolved"}</span></div>

                    <div className="text-text font-semibold mt-2 mb-1">Socket Directories (critical for session discovery)</div>
                    <div>
                      process TMPDIR: <span className="text-text">{diagnostics.env_tmpdir ?? "UNSET"}</span>
                    </div>
                    <div>
                      login shell TMPDIR: <span className="text-text">{diagnostics.login_shell_tmpdir ?? "UNSET"}</span>
                    </div>
                    {diagnostics.env_tmpdir && diagnostics.login_shell_tmpdir && diagnostics.env_tmpdir !== diagnostics.login_shell_tmpdir && (
                      <div className="text-red font-semibold">TMPDIR MISMATCH — this causes tmux to look in the wrong socket directory!</div>
                    )}
                    {diagnostics.env_tmpdir && diagnostics.login_shell_tmpdir && diagnostics.env_tmpdir === diagnostics.login_shell_tmpdir && (
                      <div className="text-green">TMPDIR matches (good)</div>
                    )}
                    <div>
                      process TMUX_TMPDIR: <span className="text-text">{diagnostics.env_tmux_tmpdir ?? "unset"}</span>
                    </div>
                    <div>
                      login shell TMUX_TMPDIR: <span className="text-text">{diagnostics.login_shell_tmux_tmpdir ?? "unset"}</span>
                    </div>

                    <div className="text-text font-semibold mt-2 mb-1">Process Environment</div>
                    <div>SHELL: <span className="text-text">{diagnostics.env_shell ?? "unset"}</span></div>
                    <div>TMUX: <span className="text-text">{diagnostics.env_tmux ?? "unset (not inside tmux)"}</span></div>
                    <div className="break-all">PATH: <span className="text-text/60">{diagnostics.env_path?.slice(0, 200) ?? "unset"}{(diagnostics.env_path?.length ?? 0) > 200 ? "..." : ""}</span></div>
                    <div className="break-all">login PATH: <span className="text-text/60">{diagnostics.login_shell_path?.slice(0, 200) ?? "unset"}{(diagnostics.login_shell_path?.length ?? 0) > 200 ? "..." : ""}</span></div>

                    <div className="text-text font-semibold mt-2 mb-1">Raw tmux list-sessions output</div>
                    {diagnostics.list_sessions_raw.error && (
                      <div className="text-red">exec error: {diagnostics.list_sessions_raw.error}</div>
                    )}
                    <div>exit code: <span className="text-text">{diagnostics.list_sessions_raw.status_code ?? "N/A"}</span></div>
                    {diagnostics.list_sessions_raw.stderr.trim() && (
                      <div className="text-yellow break-all">stderr: {diagnostics.list_sessions_raw.stderr.trim()}</div>
                    )}
                    <div className="text-subtext/70 break-all whitespace-pre-wrap">
                      stdout: {diagnostics.list_sessions_raw.stdout.trim() || "(empty — no sessions visible to this tmux instance)"}
                    </div>

                    <div className="mt-2 text-subtext/50 italic">
                      Tip: Check ~/Library/Logs/Divergence/tmux-debug.log for detailed Rust-side diagnostics.
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {!error && !loading && tmuxSessions.length > 0 && filteredSessions.length === 0 && isFiltering && (
          <EmptyState className="px-2 text-xs">
            No sessions match &quot;{searchQuery}&quot;
          </EmptyState>
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
              <IconButton
                type="button"
                className="w-5 h-5 flex items-center justify-center text-subtext hover:text-red opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                onClick={() => {
                  void handleKillSession(session.name);
                }}
                title="Kill session"
                disabled={loading}
                variant="ghost"
                size="xs"
                label={`Kill session ${session.name}`}
                icon={(
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
                )}
              />
            </div>
          );
        })}
      </div>
      </div>
    </TmuxPanelPresentational>
  );
}

export default TmuxPanel;
