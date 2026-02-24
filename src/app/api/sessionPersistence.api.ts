import {
  buildPersistedTerminalTabsSnapshot,
  normalizePersistedTerminalTabsState,
  type RestoredTerminalTabsState,
} from "../lib/sessionPersistence.pure";
import type { TerminalSession } from "../../entities";

export const TERMINAL_TABS_STORAGE_KEY = "divergence-terminal-tabs";

export function loadPersistedTerminalTabsState(): RestoredTerminalTabsState {
  try {
    const raw = localStorage.getItem(TERMINAL_TABS_STORAGE_KEY);
    if (!raw) {
      return {
        sessions: new Map(),
        activeSessionId: null,
      };
    }
    return normalizePersistedTerminalTabsState(JSON.parse(raw));
  } catch (error) {
    console.warn("Failed to load persisted terminal tabs", error);
    return {
      sessions: new Map(),
      activeSessionId: null,
    };
  }
}

export function savePersistedTerminalTabsState(input: {
  sessions: Map<string, TerminalSession>;
  activeSessionId: string | null;
}): void {
  if (input.sessions.size === 0) {
    localStorage.removeItem(TERMINAL_TABS_STORAGE_KEY);
    return;
  }

  const snapshot = buildPersistedTerminalTabsSnapshot(input);
  localStorage.setItem(TERMINAL_TABS_STORAGE_KEY, JSON.stringify(snapshot));
}

export function clearPersistedTerminalTabsState(): void {
  localStorage.removeItem(TERMINAL_TABS_STORAGE_KEY);
}
