import { useCallback, useRef } from "react";
import Terminal from "./Terminal";
import ProjectSettingsPanel from "./ProjectSettingsPanel";
import type { TerminalSession, SplitOrientation, Project } from "../types";
import type { ProjectSettings } from "../lib/projectSettings";
import { buildSplitTmuxSessionName } from "../lib/tmux";

interface MainAreaProps {
  projects: Project[];
  sessions: Map<string, TerminalSession>;
  activeSession: TerminalSession | null;
  onCloseSession: (sessionId: string) => void;
  onSelectSession: (sessionId: string) => void;
  onStatusChange: (sessionId: string, status: TerminalSession["status"]) => void;
  onRendererChange: (sessionId: string, renderer: "webgl" | "canvas") => void;
  onProjectSettingsSaved: (settings: ProjectSettings) => void;
  splitBySessionId: Map<string, { orientation: SplitOrientation }>;
  onSplitSession: (sessionId: string, orientation: SplitOrientation) => void;
  onResetSplitSession: (sessionId: string) => void;
}

function MainArea({
  projects,
  sessions,
  activeSession,
  onCloseSession,
  onSelectSession,
  onStatusChange,
  onRendererChange,
  onProjectSettingsSaved,
  splitBySessionId,
  onSplitSession,
  onResetSplitSession,
}: MainAreaProps) {
  const sessionList = Array.from(sessions.values());
  const paneStatusRef = useRef<
    Map<string, { pane1: TerminalSession["status"]; pane2: TerminalSession["status"] }>
  >(new Map());
  const activeProject = activeSession?.type === "project"
    ? projects.find(project => project.id === activeSession.targetId) ?? null
    : null;
  const activeSplit = activeSession ? splitBySessionId.get(activeSession.id) ?? null : null;

  const handleStatusChange = useCallback(
    (sessionId: string) => (status: TerminalSession["status"]) => {
      onStatusChange(sessionId, status);
    },
    [onStatusChange]
  );

  const getAggregatedStatus = useCallback((entry: { pane1: TerminalSession["status"]; pane2: TerminalSession["status"] }) => {
    if (entry.pane1 === "busy" || entry.pane2 === "busy") {
      return "busy";
    }
    if (entry.pane1 === "active" || entry.pane2 === "active") {
      return "active";
    }
    return "idle";
  }, []);

  const handleSplitStatusChange = useCallback(
    (sessionId: string, paneIndex: 0 | 1) => (status: TerminalSession["status"]) => {
      const existing = paneStatusRef.current.get(sessionId) ?? { pane1: "idle", pane2: "idle" };
      const next = { ...existing, [paneIndex === 0 ? "pane1" : "pane2"]: status };
      paneStatusRef.current.set(sessionId, next);
      onStatusChange(sessionId, getAggregatedStatus(next));
    },
    [getAggregatedStatus, onStatusChange]
  );

  const handleRendererChange = useCallback(
    (sessionId: string) => (renderer: "webgl" | "canvas") => {
      onRendererChange(sessionId, renderer);
    },
    [onRendererChange]
  );

  const renderSession = useCallback((session: TerminalSession) => {
    const splitState = splitBySessionId.get(session.id) ?? null;
    const isSplit = Boolean(splitState);
    const orientation: SplitOrientation = splitState?.orientation ?? "vertical";
    const layoutClass = orientation === "vertical" ? "flex-row" : "flex-col";
    const dividerClass = orientation === "vertical" ? "border-r border-surface" : "border-b border-surface";
    const isActiveSession = activeSession?.id === session.id;
    const effectiveUseWebgl = session.useWebgl && isActiveSession;
    const paneTwoTmuxName = session.useTmux
      ? buildSplitTmuxSessionName(session.tmuxSessionName, "pane-2")
      : session.tmuxSessionName;

    return (
      <div className={`flex h-full w-full ${layoutClass}`}>
        <div className={`flex-1 relative overflow-hidden min-w-0 min-h-0 ${isSplit ? dividerClass : ""}`}>
          <Terminal
            key={`${session.id}-${effectiveUseWebgl ? "webgl" : "canvas"}`}
            cwd={session.path}
            sessionId={session.id}
            useTmux={session.useTmux}
            tmuxSessionName={session.tmuxSessionName}
            useWebgl={effectiveUseWebgl}
            onRendererChange={handleRendererChange(session.id)}
            onStatusChange={isSplit ? handleSplitStatusChange(session.id, 0) : handleStatusChange(session.id)}
            onClose={() => onCloseSession(session.id)}
          />
        </div>
        {isSplit && (
          <div className="flex-1 relative overflow-hidden min-w-0 min-h-0">
            <Terminal
              key={`${session.id}-pane-2-${effectiveUseWebgl ? "webgl" : "canvas"}`}
              cwd={session.path}
              sessionId={`${session.id}-pane-2`}
              useTmux={session.useTmux}
              tmuxSessionName={paneTwoTmuxName}
              useWebgl={effectiveUseWebgl}
              onRendererChange={handleRendererChange(session.id)}
              onStatusChange={handleSplitStatusChange(session.id, 1)}
              onClose={() => onCloseSession(session.id)}
            />
          </div>
        )}
      </div>
    );
  }, [
    activeSession,
    handleRendererChange,
    handleSplitStatusChange,
    handleStatusChange,
    onCloseSession,
    splitBySessionId,
  ]);

  return (
    <main className="flex-1 h-full bg-main flex flex-col">
      {/* Tab bar */}
      <div className="h-10 bg-sidebar border-b border-surface flex items-center px-2 gap-1">
        <div className="flex items-center gap-1 overflow-x-auto flex-1">
          {sessionList.length === 0 ? (
            <span className="text-xs text-subtext">No terminal open</span>
          ) : (
            sessionList.map((session, index) => (
              <div
                key={session.id}
                className={`flex items-center gap-2 px-3 py-1.5 rounded cursor-pointer text-sm ${
                  session.id === activeSession?.id
                    ? "bg-main text-text"
                    : "text-subtext hover:text-text hover:bg-surface/50"
                }`}
                onClick={() => onSelectSession(session.id)}
              >
                {/* Tab number */}
                <span className="text-xs text-subtext">{index + 1}</span>

                {/* Status dot */}
                <div
                  className={`w-2 h-2 rounded-full ${
                    session.status === "busy"
                      ? "bg-yellow animate-pulse"
                      : session.status === "active"
                      ? "bg-accent"
                      : "bg-subtext/50"
                  }`}
                />

                {/* Session type icon */}
                {session.type === "divergence" ? (
                  <svg
                    className="w-3 h-3 text-accent"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                    />
                  </svg>
                ) : (
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
                      d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                    />
                  </svg>
                )}

                {/* Name */}
                <span className="truncate max-w-32">{session.name}</span>

                {/* tmux badge */}
                {session.useTmux && (
                  <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-surface text-subtext">
                    tmux
                  </span>
                )}

                {session.rendererType && (
                  <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-surface text-subtext">
                    {session.rendererType}
                  </span>
                )}

                {/* Close button */}
                <button
                  className="w-4 h-4 flex items-center justify-center text-subtext hover:text-red rounded"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCloseSession(session.id);
                  }}
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
            ))
          )}
        </div>

        <div className="flex items-center gap-2 ml-2">
          <button
            className="text-xs px-2 py-1 rounded border border-surface text-subtext hover:text-text hover:bg-surface/50 disabled:opacity-40"
            onClick={() => activeSession && onSplitSession(activeSession.id, "vertical")}
            disabled={!activeSession}
            title="Split side-by-side (Cmd+D)"
          >
            Split V
          </button>
          <button
            className="text-xs px-2 py-1 rounded border border-surface text-subtext hover:text-text hover:bg-surface/50 disabled:opacity-40"
            onClick={() => activeSession && onSplitSession(activeSession.id, "horizontal")}
            disabled={!activeSession}
            title="Split top/bottom (Cmd+Shift+D)"
          >
            Split H
          </button>
          <button
            className="text-xs px-2 py-1 rounded border border-surface text-subtext hover:text-text hover:bg-surface/50 disabled:opacity-40"
            onClick={() => activeSession && onResetSplitSession(activeSession.id)}
            disabled={!activeSession || !activeSplit}
            title="Close split"
          >
            Single
          </button>
        </div>
      </div>

      {/* Terminal area */}
      <div className="flex-1 relative overflow-hidden min-h-0">
        {activeSession ? (
          <div className={`flex h-full w-full min-h-0 ${activeProject ? "gap-0" : ""}`}>
            <div className="flex-1 relative overflow-hidden min-h-0">
              {sessionList.map((session) => (
                <div
                  key={session.id}
                  className={`absolute inset-0 ${
                    session.id === activeSession.id ? "visible z-10" : "invisible z-0"
                  }`}
                >
                  {renderSession(session)}
                </div>
              ))}
            </div>
            {activeProject && (
              <div className="w-96 border-l border-surface bg-sidebar">
                <ProjectSettingsPanel
                  project={activeProject}
                  onSaved={onProjectSettingsSaved}
                />
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 h-full flex items-center justify-center">
            <div className="text-center text-subtext">
              <svg
                className="w-16 h-16 mx-auto mb-4 opacity-50"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              <p className="text-lg">Select a project to start</p>
              <p className="text-sm mt-2">
                Each project gets its own terminal running Claude Code
              </p>
              <p className="text-xs mt-4 text-subtext/70">
                Press <kbd className="px-1.5 py-0.5 bg-surface rounded text-xs">⌘K</kbd> to quick switch
              </p>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

export default MainArea;
