import {
  buildPersistedWorkspaceTabsSnapshot,
  normalizePersistedWorkspaceTabsState,
  type RestoredWorkspaceTabsState,
} from "../lib/sessionPersistence.pure";
import type { EditorSession, TerminalSession } from "../../entities";

export const TERMINAL_TABS_STORAGE_KEY = "divergence-terminal-tabs";

export function loadPersistedWorkspaceTabsState(): RestoredWorkspaceTabsState {
  try {
    const raw = localStorage.getItem(TERMINAL_TABS_STORAGE_KEY);
    if (!raw) {
      return {
        sessions: new Map(),
        editorSessions: new Map(),
        activeSessionId: null,
      };
    }
    return normalizePersistedWorkspaceTabsState(JSON.parse(raw));
  } catch (error) {
    console.warn("Failed to load persisted terminal tabs", error);
    return {
      sessions: new Map(),
      editorSessions: new Map(),
      activeSessionId: null,
    };
  }
}

export function savePersistedWorkspaceTabsState(input: {
  sessions: Map<string, TerminalSession>;
  editorSessions: Map<string, EditorSession>;
  activeSessionId: string | null;
}): void {
  if (input.sessions.size === 0 && input.editorSessions.size === 0) {
    localStorage.removeItem(TERMINAL_TABS_STORAGE_KEY);
    return;
  }

  const snapshot = buildPersistedWorkspaceTabsSnapshot(input);
  localStorage.setItem(TERMINAL_TABS_STORAGE_KEY, JSON.stringify(snapshot));
}

export function clearPersistedWorkspaceTabsState(): void {
  localStorage.removeItem(TERMINAL_TABS_STORAGE_KEY);
}
