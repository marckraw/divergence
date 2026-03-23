import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import type { WorkspaceSession } from "../../../entities";
import { isAgentSession, isEditorSession } from "../../../entities";
import { Button, TabButton, TextInput } from "../../../shared";
import FileExplorer from "../../../widgets/main-area/ui/FileExplorer.container";
import type {
  PendingStagePaneCreateAction,
  PendingStagePaneCreateContext,
} from "./lib/pendingStagePane.pure";

type PendingPaneTab = "files" | "sessions";

interface PendingStagePaneProps {
  sessions: WorkspaceSession[];
  sourceSession: WorkspaceSession | null;
  createContext: PendingStagePaneCreateContext | null;
  onSelectExistingSession: (sessionId: string) => void;
  onOpenFile: (filePath: string, sourceSession: WorkspaceSession | null) => void;
  onCreateSession: (action: PendingStagePaneCreateAction) => void;
  onClose: () => void;
}

function PendingStagePane({
  sessions,
  sourceSession,
  createContext,
  onSelectExistingSession,
  onOpenFile,
  onCreateSession,
  onClose,
}: PendingStagePaneProps) {
  const hasFileSource = Boolean(sourceSession?.path);
  const [activeTab, setActiveTab] = useState<PendingPaneTab>(hasFileSource ? "files" : "sessions");
  const [query, setQuery] = useState("");
  useEffect(() => {
    setActiveTab(hasFileSource ? "files" : "sessions");
  }, [hasFileSource, sourceSession?.id]);
  const normalizedQuery = query.trim().toLowerCase();
  const filteredCreateActions = useMemo(() => {
    const actions = createContext?.actions ?? [];
    if (!normalizedQuery) {
      return actions;
    }

    return actions.filter((action) => {
      const searchable = [action.label, action.description].join(" ").toLowerCase();
      return searchable.includes(normalizedQuery);
    });
  }, [createContext, normalizedQuery]);
  const filteredSessions = useMemo(() => {
    if (!normalizedQuery) {
      return sessions;
    }

    return sessions.filter((session) => {
      const kindLabel = isAgentSession(session)
        ? session.model
        : isEditorSession(session)
          ? `editor ${session.filePath}`
          : session.type;
      const searchable = [
        session.name,
        session.status,
        kindLabel,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return searchable.includes(normalizedQuery);
    });
  }, [normalizedQuery, sessions]);
  const isEmpty = filteredCreateActions.length === 0 && filteredSessions.length === 0;

  return (
    <div className="flex h-full min-h-0 items-center justify-center bg-sidebar/30 p-5">
      <div className="flex h-full max-h-[72vh] w-full max-w-5xl min-h-0 flex-col overflow-hidden rounded-2xl border border-surface bg-main/90 shadow-[0_24px_80px_-52px_rgba(0,0,0,0.95)]">
        <div className="border-b border-surface px-4 py-3">
          <h2 className="text-sm font-semibold text-text">Open in pane</h2>
          <p className="mt-1 text-xs text-subtext">
            {hasFileSource
              ? "Browse files from the source session, or switch to sessions to reuse or create another session in this pane."
              : createContext?.description ?? "Choose an existing session, or create a new one while this pane stays focused."}
          </p>
        </div>
        {hasFileSource && (
          <div className="flex items-center border-b border-surface px-2">
            <TabButton active={activeTab === "files"} onClick={() => setActiveTab("files")}>
              Files
            </TabButton>
            <TabButton active={activeTab === "sessions"} onClick={() => setActiveTab("sessions")}>
              Sessions
            </TabButton>
          </div>
        )}
        <div className="flex-1 min-h-0 overflow-hidden">
          {activeTab === "files" && hasFileSource ? (
            <FileExplorer
              rootPath={sourceSession?.path ?? null}
              activeFilePath={null}
              allowRemove={false}
              onOpenFile={(path) => onOpenFile(path, sourceSession)}
              onRemoveFile={() => {}}
            />
          ) : (
            <div className="flex h-full min-h-0 flex-col space-y-3 p-4">
              <TextInput
                value={query}
                onChange={(event: ChangeEvent<HTMLInputElement>) => setQuery(event.target.value)}
                placeholder="Search sessions..."
                aria-label="Search sessions"
              />
              <div className="flex-1 space-y-3 overflow-y-auto">
                {filteredCreateActions.length > 0 && createContext && (
                  <div className="space-y-2">
                    <div className="px-1 text-[10px] uppercase tracking-[0.14em] text-subtext">
                      {createContext.title}
                    </div>
                    {filteredCreateActions.map((action) => (
                      <Button
                        key={action.id}
                        type="button"
                        variant="ghost"
                        className="flex w-full items-center justify-between gap-3 rounded-xl border border-surface/80 bg-sidebar/30 px-3 py-2 text-left hover:bg-sidebar/60"
                        onClick={() => onCreateSession(action)}
                      >
                        <div className="min-w-0">
                          <div className="truncate text-sm text-text">{action.label}</div>
                          <div className="mt-1 truncate text-[11px] text-subtext">{action.description}</div>
                        </div>
                        <span className="shrink-0 rounded-full border border-surface px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-subtext">
                          {action.sessionKind === "agent" ? "Agent" : "Terminal"}
                        </span>
                      </Button>
                    ))}
                  </div>
                )}
                {filteredSessions.length > 0 && (
                  <div className="space-y-2">
                    {filteredCreateActions.length > 0 && (
                      <div className="px-1 text-[10px] uppercase tracking-[0.14em] text-subtext">
                        Already Open
                      </div>
                    )}
                    {filteredSessions.map((session: WorkspaceSession) => (
                      <Button
                        key={session.id}
                        type="button"
                        variant="ghost"
                        className="flex w-full items-center justify-between gap-3 rounded-xl border border-surface/80 bg-sidebar/40 px-3 py-2 text-left hover:bg-sidebar/70"
                        onClick={() => onSelectExistingSession(session.id)}
                      >
                        <div className="min-w-0">
                          <div className="truncate text-sm text-text">{session.name}</div>
                          <div className="mt-1 flex items-center gap-2 text-[11px] text-subtext">
                            <span>{session.status}</span>
                            <span className="text-subtext/60">&middot;</span>
                            <span>
                              {isAgentSession(session)
                                ? `${session.provider} • ${session.model}`
                                : isEditorSession(session)
                                  ? session.filePath
                                  : session.type}
                            </span>
                          </div>
                        </div>
                        <span className="shrink-0 rounded-full border border-surface px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-subtext">
                          {isAgentSession(session) ? "Agent" : isEditorSession(session) ? "Editor" : "Terminal"}
                        </span>
                      </Button>
                    ))}
                  </div>
                )}
                {isEmpty && (
                  <div className="rounded-xl border border-dashed border-surface px-4 py-6 text-center text-sm text-subtext">
                    No matching options.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        <div className="flex items-center justify-between border-t border-surface px-4 py-3 text-xs text-subtext">
          <span>{hasFileSource ? "Choose a file to open it here, or switch to sessions to reuse an existing tab." : "Choose a session, or create a new one for this pane."}</span>
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}

export default PendingStagePane;
