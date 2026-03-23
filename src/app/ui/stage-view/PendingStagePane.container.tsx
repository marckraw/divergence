import { useMemo, useState, type ChangeEvent } from "react";
import type { WorkspaceSession } from "../../../entities";
import { isAgentSession, isEditorSession } from "../../../entities";
import { Button, TextInput } from "../../../shared";
import type {
  PendingStagePaneCreateAction,
  PendingStagePaneCreateContext,
} from "./lib/pendingStagePane.pure";

interface PendingStagePaneProps {
  sessions: WorkspaceSession[];
  createContext: PendingStagePaneCreateContext | null;
  onSelectExistingSession: (sessionId: string) => void;
  onCreateSession: (action: PendingStagePaneCreateAction) => void;
  onClose: () => void;
}

function PendingStagePane({
  sessions,
  createContext,
  onSelectExistingSession,
  onCreateSession,
  onClose,
}: PendingStagePaneProps) {
  const [query, setQuery] = useState("");
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
      <div className="w-full max-w-lg rounded-2xl border border-surface bg-main/90 shadow-[0_24px_80px_-52px_rgba(0,0,0,0.95)]">
        <div className="border-b border-surface px-4 py-3">
          <h2 className="text-sm font-semibold text-text">Open in pane</h2>
          <p className="mt-1 text-xs text-subtext">
            {createContext?.description ?? "Choose an existing session, or create a new one from the sidebar while this pane stays focused."}
          </p>
        </div>
        <div className="space-y-3 p-4">
          <TextInput
            value={query}
            onChange={(event: ChangeEvent<HTMLInputElement>) => setQuery(event.target.value)}
            placeholder="Search sessions..."
            aria-label="Search sessions"
          />
          <div className="max-h-72 space-y-3 overflow-y-auto">
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
        <div className="flex items-center justify-between border-t border-surface px-4 py-3 text-xs text-subtext">
          <span>Press the session tabs or sidebar to fill this pane too.</span>
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}

export default PendingStagePane;
