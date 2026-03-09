import { useCallback, useEffect } from "react";
import type { Project, SplitSessionState, WorkspaceSession } from "../../entities";
import { isAgentSession } from "../../entities";
import type { WorkSidebarMode, WorkSidebarTab } from "../../features/work-sidebar";
import {
  closeFocusedSplitPane,
  focusNextSplitPane,
  focusPreviousSplitPane,
  isDefaultSinglePaneState,
} from "../lib/splitSession.pure";
import { resolveAppShortcut } from "../lib/appShortcuts.pure";
import { resolveProjectForNewDivergence } from "../lib/appSelection.pure";

interface UseAppKeyboardShortcutsParams {
  sessions: Map<string, WorkspaceSession>;
  activeSessionId: string | null;
  splitBySessionId: Map<string, SplitSessionState>;
  setSplitBySessionId: React.Dispatch<React.SetStateAction<Map<string, SplitSessionState>>>;
  projects: Project[];
  createDivergenceFor: Project | null;
  handleCloseSession: (sessionId: string) => void;
  handleSplitSession: (sessionId: string, orientation: "vertical" | "horizontal") => void;
  handleReconnectSession: (sessionId: string) => void;
  toggleSidebar: () => void;
  toggleRightPanel: () => void;
  setIsSidebarOpen: (open: boolean) => void;
  setSidebarMode: React.Dispatch<React.SetStateAction<WorkSidebarMode>>;
  setWorkTab: (tab: WorkSidebarTab) => void;
  setActiveSessionId: React.Dispatch<React.SetStateAction<string | null>>;
  setShowQuickSwitcher: React.Dispatch<React.SetStateAction<boolean>>;
  setShowFileQuickSwitcher: React.Dispatch<React.SetStateAction<boolean>>;
  setShowSettings: React.Dispatch<React.SetStateAction<boolean>>;
  setCreateDivergenceFor: React.Dispatch<React.SetStateAction<Project | null>>;
}

export function useAppKeyboardShortcuts({
  sessions,
  activeSessionId,
  splitBySessionId,
  setSplitBySessionId,
  projects,
  createDivergenceFor,
  handleCloseSession,
  handleSplitSession,
  handleReconnectSession,
  toggleSidebar,
  toggleRightPanel,
  setIsSidebarOpen,
  setSidebarMode,
  setWorkTab,
  setActiveSessionId,
  setShowQuickSwitcher,
  setShowFileQuickSwitcher,
  setShowSettings,
  setCreateDivergenceFor,
}: UseAppKeyboardShortcutsParams): void {
  const resolveProjectForNewDivergenceCallback = useCallback((): Project | null => {
    return resolveProjectForNewDivergence({
      activeSessionId,
      sessions,
      projects,
    });
  }, [activeSessionId, sessions, projects]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const isFromEditor = e.target instanceof HTMLElement
      ? Boolean(e.target.closest("[data-editor-root='true'], .cm-editor"))
      : false;
    const action = resolveAppShortcut(e, {
      isFromEditor,
      hasActiveSession: Boolean(activeSessionId),
      activeSessionId,
      sessionCount: sessions.size,
      hasCreateDivergenceModalOpen: Boolean(createDivergenceFor),
      canResolveProjectForNewDivergence: Boolean(resolveProjectForNewDivergenceCallback()),
    });
    if (!action) {
      return;
    }

    e.preventDefault();
    const sessionIds = Array.from(sessions.keys());

    switch (action.type) {
      case "toggle_quick_switcher":
        setShowQuickSwitcher(prev => !prev);
        return;
      case "toggle_file_quick_switcher":
        setShowFileQuickSwitcher(prev => !prev);
        return;
      case "open_work_inbox":
        setIsSidebarOpen(true);
        setSidebarMode("work");
        setWorkTab("inbox");
        return;
      case "toggle_settings":
        setShowSettings(prev => !prev);
        return;
      case "toggle_right_panel":
        toggleRightPanel();
        return;
      case "toggle_sidebar":
        toggleSidebar();
        return;
      case "close_overlays":
        setShowQuickSwitcher(false);
        setShowFileQuickSwitcher(false);
        setShowSettings(false);
        return;
      case "close_active_session":
        if (activeSessionId) {
          const splitState = splitBySessionId.get(activeSessionId) ?? null;
          if (splitState && splitState.paneIds.length > 1) {
            setSplitBySessionId((prev) => {
              const current = prev.get(activeSessionId);
              if (!current || current.paneIds.length <= 1) {
                return prev;
              }
              const nextState = closeFocusedSplitPane(current);
              const next = new Map(prev);
              if (!nextState || isDefaultSinglePaneState(nextState)) {
                next.delete(activeSessionId);
              } else {
                next.set(activeSessionId, nextState);
              }
              return next;
            });
          } else {
            handleCloseSession(activeSessionId);
          }
        }
        return;
      case "new_divergence": {
        const project = resolveProjectForNewDivergenceCallback();
        if (project) {
          setShowQuickSwitcher(false);
          setShowSettings(false);
          setCreateDivergenceFor(project);
        }
        return;
      }
      case "split_terminal":
        if (activeSessionId) {
          const activeSession = sessions.get(activeSessionId);
          if (!activeSession || isAgentSession(activeSession)) {
            return;
          }
          handleSplitSession(activeSessionId, action.orientation);
        }
        return;
      case "reconnect_terminal":
        if (activeSessionId) {
          const activeSession = sessions.get(activeSessionId);
          if (!activeSession || isAgentSession(activeSession)) {
            return;
          }
          handleReconnectSession(activeSessionId);
        }
        return;
      case "select_tab":
        if (action.index < sessionIds.length) {
          setActiveSessionId(sessionIds[action.index]);
        }
        return;
      case "select_previous_tab":
        if (activeSessionId && sessionIds.length > 1) {
          const currentIndex = sessionIds.indexOf(activeSessionId);
          const prevIndex = currentIndex > 0 ? currentIndex - 1 : sessionIds.length - 1;
          setActiveSessionId(sessionIds[prevIndex]);
        }
        return;
      case "select_next_tab":
        if (activeSessionId && sessionIds.length > 1) {
          const currentIndex = sessionIds.indexOf(activeSessionId);
          const nextIndex = currentIndex < sessionIds.length - 1 ? currentIndex + 1 : 0;
          setActiveSessionId(sessionIds[nextIndex]);
        }
        return;
      case "focus_previous_pane":
        if (activeSessionId) {
          setSplitBySessionId((prev) => {
            const current = prev.get(activeSessionId);
            if (!current || current.paneIds.length <= 1) {
              return prev;
            }
            const next = new Map(prev);
            next.set(activeSessionId, focusPreviousSplitPane(current));
            return next;
          });
        }
        return;
      case "focus_next_pane":
        if (activeSessionId) {
          setSplitBySessionId((prev) => {
            const current = prev.get(activeSessionId);
            if (!current || current.paneIds.length <= 1) {
              return prev;
            }
            const next = new Map(prev);
            next.set(activeSessionId, focusNextSplitPane(current));
            return next;
          });
        }
        return;
      default:
        return;
    }
  }, [
    sessions,
    activeSessionId,
    splitBySessionId,
    createDivergenceFor,
    resolveProjectForNewDivergenceCallback,
    handleCloseSession,
    handleSplitSession,
    handleReconnectSession,
    toggleSidebar,
    toggleRightPanel,
    setIsSidebarOpen,
    setSidebarMode,
    setWorkTab,
    setActiveSessionId,
    setShowQuickSwitcher,
    setShowFileQuickSwitcher,
    setShowSettings,
    setCreateDivergenceFor,
    setSplitBySessionId,
  ]);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);
}
