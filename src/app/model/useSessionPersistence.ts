import { useEffect, useRef, useState } from "react";
import type { EditorSession, TerminalSession } from "../../entities";
import {
  clearPersistedWorkspaceTabsState,
  loadPersistedWorkspaceTabsState,
  savePersistedWorkspaceTabsState,
} from "../api/sessionPersistence.api";
import { createDebouncedTask } from "../../shared";

const RESTORE_TABS_TOAST_TTL_MS = 4000;
const SESSION_PERSISTENCE_DEBOUNCE_MS = 250;

interface UseSessionPersistenceParams {
  sessions: Map<string, TerminalSession>;
  setSessions: React.Dispatch<React.SetStateAction<Map<string, TerminalSession>>>;
  editorSessions: Map<string, EditorSession>;
  setEditorSessions: React.Dispatch<React.SetStateAction<Map<string, EditorSession>>>;
  activeSessionId: string | null;
  setActiveSessionId: React.Dispatch<React.SetStateAction<string | null>>;
  restoreTabsOnRestart: boolean;
}

interface UseSessionPersistenceResult {
  hasRestoredTabs: boolean;
  restoredTabsToastMessage: string | null;
  setRestoredTabsToastMessage: React.Dispatch<React.SetStateAction<string | null>>;
}

export function useSessionPersistence({
  sessions,
  setSessions,
  editorSessions,
  setEditorSessions,
  activeSessionId,
  setActiveSessionId,
  restoreTabsOnRestart,
}: UseSessionPersistenceParams): UseSessionPersistenceResult {
  const [hasRestoredTabs, setHasRestoredTabs] = useState(false);
  const [restoredTabsToastMessage, setRestoredTabsToastMessage] = useState<string | null>(null);
  const hasRestoredTabsRef = useRef(false);
  const restoredTabsToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingPersistRef = useRef({
    sessions,
    editorSessions,
    activeSessionId,
    restoreTabsOnRestart,
  });
  const persistTaskRef = useRef(createDebouncedTask(() => {
    const pending = pendingPersistRef.current;
    if (!pending.restoreTabsOnRestart) {
      clearPersistedWorkspaceTabsState();
      return;
    }

    savePersistedWorkspaceTabsState({
      sessions: pending.sessions,
      editorSessions: pending.editorSessions,
      activeSessionId: pending.activeSessionId,
    });
  }, SESSION_PERSISTENCE_DEBOUNCE_MS));

  pendingPersistRef.current = {
    sessions,
    editorSessions,
    activeSessionId,
    restoreTabsOnRestart,
  };

  useEffect(() => {
    const persistTask = persistTaskRef.current;
    return () => {
      if (restoredTabsToastTimerRef.current) {
        clearTimeout(restoredTabsToastTimerRef.current);
      }
      persistTask.flush();
      persistTask.cancel();
    };
  }, []);

  useEffect(() => {
    if (hasRestoredTabsRef.current) {
      return;
    }
    hasRestoredTabsRef.current = true;

    if (!restoreTabsOnRestart) {
      clearPersistedWorkspaceTabsState();
      setHasRestoredTabs(true);
      return;
    }

    const restored = loadPersistedWorkspaceTabsState();
    if (restored.sessions.size === 0 && restored.editorSessions.size === 0) {
      setHasRestoredTabs(true);
      return;
    }

    setSessions(restored.sessions);
    setEditorSessions(restored.editorSessions);
    setActiveSessionId(restored.activeSessionId);
    setRestoredTabsToastMessage(
      `Restored ${restored.sessions.size + restored.editorSessions.size} tab${
        restored.sessions.size + restored.editorSessions.size === 1 ? "" : "s"
      } from your previous session.`
    );
    if (restoredTabsToastTimerRef.current) {
      clearTimeout(restoredTabsToastTimerRef.current);
    }
    restoredTabsToastTimerRef.current = setTimeout(() => {
      setRestoredTabsToastMessage(null);
      restoredTabsToastTimerRef.current = null;
    }, RESTORE_TABS_TOAST_TTL_MS);
    setHasRestoredTabs(true);
  }, [restoreTabsOnRestart, setEditorSessions, setSessions, setActiveSessionId]);

  useEffect(() => {
    if (!hasRestoredTabsRef.current) {
      return;
    }

    if (!restoreTabsOnRestart) {
      persistTaskRef.current.cancel();
      clearPersistedWorkspaceTabsState();
      return;
    }

    persistTaskRef.current.schedule();
  }, [sessions, editorSessions, activeSessionId, restoreTabsOnRestart]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      persistTaskRef.current.flush();
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, []);

  return {
    hasRestoredTabs,
    restoredTabsToastMessage,
    setRestoredTabsToastMessage,
  };
}
