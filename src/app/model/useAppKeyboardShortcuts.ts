import { useCallback, useEffect } from "react";
import type { StageLayout, StageTabId, WorkspaceSession } from "../../entities";
import { isAgentSession } from "../../entities";
import type { WorkSidebarMode, WorkSidebarTab } from "../../features/work-sidebar";
import { resolveAppShortcut } from "../lib/appShortcuts.pure";

interface UseAppKeyboardShortcutsParams {
  sessions: Map<string, WorkspaceSession>;
  activeSessionId: string | null;
  stageLayout: StageLayout | null;
  stageTabIds: StageTabId[];
  quickSwitcherMode: "replace" | "reveal";
  handleCreateTab: () => void;
  handleFocusStageTab: (tabId: StageTabId) => void;
  handleFocusNextStageTab: () => void;
  handleFocusPreviousStageTab: () => void;
  handleSplitStage: (orientation: "vertical" | "horizontal") => void;
  handleCloseFocusedStagePane: () => void;
  handleReconnectSession: (sessionId: string) => void;
  focusPreviousStagePane: () => void;
  focusNextStagePane: () => void;
  toggleSidebar: () => void;
  toggleRightPanel: () => void;
  setIsSidebarOpen: (open: boolean) => void;
  setSidebarMode: React.Dispatch<React.SetStateAction<WorkSidebarMode>>;
  setWorkTab: (tab: WorkSidebarTab) => void;
  setShowQuickSwitcher: React.Dispatch<React.SetStateAction<boolean>>;
  setQuickSwitcherMode: React.Dispatch<React.SetStateAction<"replace" | "reveal">>;
  setShowFileQuickSwitcher: React.Dispatch<React.SetStateAction<boolean>>;
  setShowSettings: React.Dispatch<React.SetStateAction<boolean>>;
}

export function useAppKeyboardShortcuts({
  sessions,
  activeSessionId,
  stageLayout,
  stageTabIds,
  quickSwitcherMode,
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
  setShowQuickSwitcher,
  setQuickSwitcherMode,
  setShowFileQuickSwitcher,
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
        setQuickSwitcherMode("replace");
        setShowQuickSwitcher((prev) => (quickSwitcherMode === "replace" ? !prev : true));
        return;
      case "toggle_quick_switcher_reveal":
        setQuickSwitcherMode("reveal");
        setShowQuickSwitcher((prev) => (quickSwitcherMode === "reveal" ? !prev : true));
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
      case "close_focused_pane":
        handleCloseFocusedStagePane();
        return;
      case "new_tab":
        handleCreateTab();
        return;
      case "split_terminal":
        if (stageLayout || activeSessionId) {
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
    quickSwitcherMode,
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
    setShowQuickSwitcher,
    setQuickSwitcherMode,
    setShowFileQuickSwitcher,
    setShowSettings,
  ]);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);
}
