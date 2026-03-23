import { useCallback, useEffect } from "react";
import type { Project, StageLayout, StagePane, WorkspaceSession } from "../../entities";
import { isAgentSession } from "../../entities";
import type { CommandCenterMode } from "../../features/command-center";
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
  handleSplitStage: (orientation: "vertical" | "horizontal") => import("../../entities").StagePaneId | null;
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
  setCommandCenterMode: React.Dispatch<React.SetStateAction<CommandCenterMode | null>>;
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
  setCommandCenterMode,
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
        if (!focusedStagePane) {
          return;
        }
        setCommandCenterMode((previous) => previous
          ? null
          : { kind: "replace", targetPaneId: focusedStagePane.id });
        return;
      case "toggle_quick_switcher_reveal":
        setCommandCenterMode((previous) => previous?.kind === "reveal" ? null : { kind: "reveal" });
        return;
      case "toggle_file_quick_switcher":
        if (!activeSessionId || !focusedStagePane) {
          return;
        }
        const activeSession = sessions.get(activeSessionId);
        if (!activeSession) {
          return;
        }
        setCommandCenterMode((previous) => previous
          ? null
          : {
            kind: "open-file",
            targetPaneId: focusedStagePane.id,
            rootPath: activeSession.path,
          });
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
        setCommandCenterMode(null);
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
          setCommandCenterMode(null);
          setShowSettings(false);
          setCreateDivergenceFor(project);
        }
        return;
      }
      case "split_terminal":
        if (activeSessionId) {
          const paneId = handleSplitStage(action.orientation);
          if (paneId) {
            setCommandCenterMode({
              kind: "open-in-pane",
              targetPaneId: paneId,
              sourceSessionId: activeSessionId,
            });
          }
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
    setCommandCenterMode,
    setShowSettings,
    setCreateDivergenceFor,
  ]);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);
}
