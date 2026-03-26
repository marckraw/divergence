import { useEffect, useRef } from "react";
import type { StageLayout, StageTabId, WorkspaceSession } from "../../entities";
import { isAgentSession } from "../../entities";
import type { CommandCenterMode } from "../../features/command-center";
import type { WorkSidebarMode, WorkSidebarTab } from "../../features/work-sidebar";
import { resolveAppShortcut } from "../lib/appShortcuts.pure";
import type { StagePaneId } from "../../entities";

interface UseAppKeyboardShortcutsParams {
  sessions: Map<string, WorkspaceSession>;
  activeSessionId: string | null;
  stageLayout: StageLayout | null;
  stageTabIds: StageTabId[];
  handleCreateTab: () => void;
  handleFocusStageTab: (tabId: StageTabId) => void;
  handleFocusNextStageTab: () => void;
  handleFocusPreviousStageTab: () => void;
  handleSplitStage: (orientation: "vertical" | "horizontal") => StagePaneId | null;
  handleCloseFocusedStagePane: () => void;
  handleReconnectSession: (sessionId: string) => void;
  focusPreviousStagePane: () => void;
  focusNextStagePane: () => void;
  toggleSidebar: () => void;
  toggleRightPanel: () => void;
  setIsSidebarOpen: (open: boolean) => void;
  setSidebarMode: React.Dispatch<React.SetStateAction<WorkSidebarMode>>;
  setWorkTab: (tab: WorkSidebarTab) => void;
  setCommandCenterMode: React.Dispatch<React.SetStateAction<CommandCenterMode | null>>;
  focusedPaneId: StagePaneId;
  activeSessionPath: string;
  setShowSettings: React.Dispatch<React.SetStateAction<boolean>>;
}

export function useAppKeyboardShortcuts({
  sessions,
  activeSessionId,
  stageLayout,
  stageTabIds,
  handleCreateTab,
  handleFocusStageTab,
  handleFocusNextStageTab,
  handleFocusPreviousStageTab,
  handleSplitStage,
  handleCloseFocusedStagePane,
  handleReconnectSession,
  focusPreviousStagePane,
  focusNextStagePane,
  toggleSidebar,
  toggleRightPanel,
  setIsSidebarOpen,
  setSidebarMode,
  setWorkTab,
  setCommandCenterMode,
  focusedPaneId,
  activeSessionPath,
  setShowSettings,
}: UseAppKeyboardShortcutsParams): void {
  const paramsRef = useRef<UseAppKeyboardShortcutsParams>({
    sessions,
    activeSessionId,
    stageLayout,
    stageTabIds,
    handleCreateTab,
    handleFocusStageTab,
    handleFocusNextStageTab,
    handleFocusPreviousStageTab,
    handleSplitStage,
    handleCloseFocusedStagePane,
    handleReconnectSession,
    focusPreviousStagePane,
    focusNextStagePane,
    toggleSidebar,
    toggleRightPanel,
    setIsSidebarOpen,
    setSidebarMode,
    setWorkTab,
    setCommandCenterMode,
    focusedPaneId,
    activeSessionPath,
    setShowSettings,
  });

  paramsRef.current = {
    sessions,
    activeSessionId,
    stageLayout,
    stageTabIds,
    handleCreateTab,
    handleFocusStageTab,
    handleFocusNextStageTab,
    handleFocusPreviousStageTab,
    handleSplitStage,
    handleCloseFocusedStagePane,
    handleReconnectSession,
    focusPreviousStagePane,
    focusNextStagePane,
    toggleSidebar,
    toggleRightPanel,
    setIsSidebarOpen,
    setSidebarMode,
    setWorkTab,
    setCommandCenterMode,
    focusedPaneId,
    activeSessionPath,
    setShowSettings,
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const {
        sessions: currentSessions,
        activeSessionId: currentActiveSessionId,
        stageLayout: currentStageLayout,
        stageTabIds: currentStageTabIds,
        handleCreateTab: onCreateTab,
        handleFocusStageTab: onFocusStageTab,
        handleFocusNextStageTab: onFocusNextStageTab,
        handleFocusPreviousStageTab: onFocusPreviousStageTab,
        handleSplitStage: onSplitStage,
        handleCloseFocusedStagePane: onCloseFocusedStagePane,
        handleReconnectSession: onReconnectSession,
        focusPreviousStagePane: onFocusPreviousStagePane,
        focusNextStagePane: onFocusNextStagePane,
        toggleSidebar: onToggleSidebar,
        toggleRightPanel: onToggleRightPanel,
        setIsSidebarOpen: onSetSidebarOpen,
        setSidebarMode: onSetSidebarMode,
        setWorkTab: onSetWorkTab,
        setCommandCenterMode: onSetCommandCenterMode,
        focusedPaneId: currentFocusedPaneId,
        activeSessionPath: currentActiveSessionPath,
        setShowSettings: onSetShowSettings,
      } = paramsRef.current;

    const isFromEditor = e.target instanceof HTMLElement
      ? Boolean(e.target.closest("[data-editor-root='true'], .cm-editor"))
      : false;
    const action = resolveAppShortcut(e, {
      isFromEditor,
      hasActiveSession: Boolean(currentActiveSessionId),
      activeSessionId: currentActiveSessionId,
      hasOpenStage: Boolean(currentStageLayout),
      tabCount: currentStageTabIds.length,
    });
    if (!action) {
      return;
    }

    e.preventDefault();

    switch (action.type) {
      case "toggle_quick_switcher":
        onSetCommandCenterMode((prev) =>
          prev?.kind === "replace" ? null : { kind: "replace", targetPaneId: currentFocusedPaneId },
        );
        return;
      case "toggle_quick_switcher_reveal":
        onSetCommandCenterMode((prev) =>
          prev?.kind === "reveal" ? null : { kind: "reveal" },
        );
        return;
      case "toggle_file_quick_switcher":
        onSetCommandCenterMode((prev) =>
          prev?.kind === "open-file" ? null : {
            kind: "open-file",
            targetPaneId: currentFocusedPaneId,
            rootPath: currentActiveSessionPath,
          },
        );
        return;
      case "open_work_inbox":
        onSetSidebarOpen(true);
        onSetSidebarMode("work");
        onSetWorkTab("inbox");
        return;
      case "toggle_settings":
        onSetShowSettings(prev => !prev);
        return;
      case "toggle_right_panel":
        onToggleRightPanel();
        return;
      case "toggle_sidebar":
        onToggleSidebar();
        return;
      case "close_overlays":
        onSetCommandCenterMode(null);
        onSetShowSettings(false);
        return;
      case "close_focused_pane":
        onCloseFocusedStagePane();
        return;
      case "new_tab":
        onCreateTab();
        return;
      case "split_terminal": {
        if (currentStageLayout || currentActiveSessionId) {
          const newPaneId = onSplitStage(action.orientation);
          if (newPaneId) {
            onSetCommandCenterMode({
              kind: "open-in-pane",
              targetPaneId: newPaneId,
              sourceSessionId: currentActiveSessionId ?? undefined,
            });
          }
        }
        return;
      }
      case "reconnect_terminal":
        if (currentActiveSessionId) {
          const activeSession = currentSessions.get(currentActiveSessionId);
          if (!activeSession || isAgentSession(activeSession)) {
            return;
          }
          onReconnectSession(currentActiveSessionId);
        }
        return;
      case "select_tab":
        if (action.index < currentStageTabIds.length) {
          onFocusStageTab(currentStageTabIds[action.index]);
        }
        return;
      case "focus_next_tab":
        onFocusNextStageTab();
        return;
      case "focus_previous_tab":
        onFocusPreviousStageTab();
        return;
      case "focus_previous_pane":
        if (currentStageLayout && currentStageLayout.panes.length > 1) {
          onFocusPreviousStagePane();
        }
        return;
      case "focus_next_pane":
        if (currentStageLayout && currentStageLayout.panes.length > 1) {
          onFocusNextStagePane();
        }
        return;
      default:
        return;
    }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);
}
