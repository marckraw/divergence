import { useEffect, useRef, useState } from "react";
import type { TerminalSession } from "../../entities";
import {
  clearPersistedTerminalTabsState,
  loadPersistedTerminalTabsState,
  savePersistedTerminalTabsState,
} from "../api/sessionPersistence.api";
import { createDebouncedTask } from "../../shared";

const RESTORE_TABS_TOAST_TTL_MS = 4000;
const SESSION_PERSISTENCE_DEBOUNCE_MS = 250;

interface UseSessionPersistenceParams {
  sessions: Map<string, TerminalSession>;
  setSessions: React.Dispatch<React.SetStateAction<Map<string, TerminalSession>>>;
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
    activeSessionId,
    restoreTabsOnRestart,
  });
  const persistTaskRef = useRef(createDebouncedTask(() => {
    const pending = pendingPersistRef.current;
    if (!pending.restoreTabsOnRestart) {
      clearPersistedTerminalTabsState();
      return;
    }

    savePersistedTerminalTabsState({
      sessions: pending.sessions,
      activeSessionId: pending.activeSessionId,
    });
  }, SESSION_PERSISTENCE_DEBOUNCE_MS));

  pendingPersistRef.current = {
    sessions,
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
      clearPersistedTerminalTabsState();
      setHasRestoredTabs(true);
      return;
    }

    const restored = loadPersistedTerminalTabsState();
    if (restored.sessions.size === 0) {
      setHasRestoredTabs(true);
      return;
    }

    setSessions(restored.sessions);
    setActiveSessionId(restored.activeSessionId);
    setRestoredTabsToastMessage(
      `Restored ${restored.sessions.size} tab${restored.sessions.size === 1 ? "" : "s"} from your previous session.`
    );
    if (restoredTabsToastTimerRef.current) {
      clearTimeout(restoredTabsToastTimerRef.current);
    }
    restoredTabsToastTimerRef.current = setTimeout(() => {
      setRestoredTabsToastMessage(null);
      restoredTabsToastTimerRef.current = null;
    }, RESTORE_TABS_TOAST_TTL_MS);
    setHasRestoredTabs(true);
  }, [restoreTabsOnRestart, setSessions, setActiveSessionId]);

  useEffect(() => {
    if (!hasRestoredTabsRef.current) {
      return;
    }

    if (!restoreTabsOnRestart) {
      persistTaskRef.current.cancel();
      clearPersistedTerminalTabsState();
      return;
    }

    persistTaskRef.current.schedule();
  }, [sessions, activeSessionId, restoreTabsOnRestart]);

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
