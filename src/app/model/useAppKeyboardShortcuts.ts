import { useCallback, useEffect } from "react";
import type { Project, StageLayout, StagePane, WorkspaceSession } from "../../entities";
import { isAgentSession } from "../../entities";
import type { WorkSidebarMode, WorkSidebarTab } from "../../features/work-sidebar";
import { resolveAppShortcut } from "../lib/appShortcuts.pure";
import { resolveProjectForNewDivergence } from "../lib/appSelection.pure";

interface UseAppKeyboardShortcutsParams {
  sessions: Map<string, WorkspaceSession>;
  activeSessionId: string | null;
  stageLayout: StageLayout | null;
  focusedStagePane: StagePane | null;
  projects: Project[];
  createDivergenceFor: Project | null;
  handleCloseSession: (sessionId: string) => void;
  handleSplitStage: (orientation: "vertical" | "horizontal") => void;
  handleCloseStagePane: (paneId: StagePane["id"]) => void;
  handleReconnectSession: (sessionId: string) => void;
  focusPreviousStagePane: () => void;
  focusNextStagePane: () => void;
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
  stageLayout,
  focusedStagePane,
  projects,
  createDivergenceFor,
  handleCloseSession,
  handleSplitStage,
  handleCloseStagePane,
  handleReconnectSession,
  focusPreviousStagePane,
  focusNextStagePane,
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
          if (stageLayout && stageLayout.panes.length > 1 && focusedStagePane) {
            handleCloseStagePane(focusedStagePane.id);
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
          handleSplitStage(action.orientation);
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
        if (stageLayout && stageLayout.panes.length > 1) {
          focusPreviousStagePane();
        }
        return;
      case "focus_next_pane":
        if (stageLayout && stageLayout.panes.length > 1) {
          focusNextStagePane();
        }
        return;
      default:
        return;
    }
  }, [
    sessions,
    activeSessionId,
    stageLayout,
    focusedStagePane,
    createDivergenceFor,
    resolveProjectForNewDivergenceCallback,
    handleCloseSession,
    handleSplitStage,
    handleCloseStagePane,
    handleReconnectSession,
    focusPreviousStagePane,
    focusNextStagePane,
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
  ]);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);
}
