import { useCallback, useEffect } from "react";
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
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const isFromEditor = e.target instanceof HTMLElement
      ? Boolean(e.target.closest("[data-editor-root='true'], .cm-editor"))
      : false;
    const action = resolveAppShortcut(e, {
      isFromEditor,
      hasActiveSession: Boolean(activeSessionId),
      activeSessionId,
      hasOpenStage: Boolean(stageLayout),
      tabCount: stageTabIds.length,
    });
    if (!action) {
      return;
    }

    e.preventDefault();

    switch (action.type) {
      case "toggle_quick_switcher":
        setCommandCenterMode((prev) =>
          prev?.kind === "replace" ? null : { kind: "replace", targetPaneId: focusedPaneId },
        );
        return;
      case "toggle_quick_switcher_reveal":
        setCommandCenterMode((prev) =>
          prev?.kind === "reveal" ? null : { kind: "reveal" },
        );
        return;
      case "toggle_file_quick_switcher":
        setCommandCenterMode((prev) =>
          prev?.kind === "open-file" ? null : {
            kind: "open-file",
            targetPaneId: focusedPaneId,
            rootPath: activeSessionPath,
          },
        );
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
      case "close_focused_pane":
        handleCloseFocusedStagePane();
        return;
      case "new_tab":
        handleCreateTab();
        return;
      case "split_terminal": {
        if (stageLayout || activeSessionId) {
          const newPaneId = handleSplitStage(action.orientation);
          if (newPaneId) {
            setCommandCenterMode({
              kind: "open-in-pane",
              targetPaneId: newPaneId,
              sourceSessionId: activeSessionId ?? undefined,
            });
          }
        }
        return;
      }
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
        if (action.index < stageTabIds.length) {
          handleFocusStageTab(stageTabIds[action.index]);
        }
        return;
      case "focus_next_tab":
        handleFocusNextStageTab();
        return;
      case "focus_previous_tab":
        handleFocusPreviousStageTab();
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
  ]);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);
}
