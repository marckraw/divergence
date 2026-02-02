import { useCallback } from "react";
import Terminal from "./Terminal";
import ProjectSettingsPanel from "./ProjectSettingsPanel";
import type { TerminalSession } from "../types";
import type { Project } from "../types";
import type { ProjectSettings } from "../lib/projectSettings";

interface MainAreaProps {
  projects: Project[];
  sessions: Map<string, TerminalSession>;
  activeSession: TerminalSession | null;
  onCloseSession: (sessionId: string) => void;
  onSelectSession: (sessionId: string) => void;
  onStatusChange: (sessionId: string, status: TerminalSession["status"]) => void;
  onProjectSettingsSaved: (settings: ProjectSettings) => void;
}

function MainArea({
  projects,
  sessions,
  activeSession,
  onCloseSession,
  onSelectSession,
  onStatusChange,
  onProjectSettingsSaved,
}: MainAreaProps) {
  const sessionList = Array.from(sessions.values());
  const activeProject = activeSession?.type === "project"
    ? projects.find(project => project.id === activeSession.targetId) ?? null
    : null;

  const handleStatusChange = useCallback(
    (sessionId: string) => (status: TerminalSession["status"]) => {
      onStatusChange(sessionId, status);
    },
    [onStatusChange]
  );

  return (
    <main className="flex-1 h-full bg-main flex flex-col">
      {/* Tab bar */}
      <div className="h-10 bg-sidebar border-b border-surface flex items-center px-2 gap-1 overflow-x-auto">
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

      {/* Terminal area */}
      <div className="flex-1 relative overflow-hidden">
        {activeSession ? (
          <div className={`flex h-full w-full ${activeProject ? "gap-0" : ""}`}>
            <div className="flex-1 relative overflow-hidden">
              {sessionList.map((session) => (
                <div
                  key={session.id}
                  className={`absolute inset-0 ${
                    session.id === activeSession.id ? "visible z-10" : "invisible z-0"
                  }`}
                >
                  <Terminal
                    cwd={session.path}
                    sessionId={session.id}
                    useTmux={session.useTmux}
                    tmuxSessionName={session.tmuxSessionName}
                    onStatusChange={handleStatusChange(session.id)}
                    onClose={() => onCloseSession(session.id)}
                  />
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
