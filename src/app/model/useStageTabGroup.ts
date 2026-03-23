import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import {
  addTab,
  addTabWithRef,
  buildSinglePaneLayout,
  buildSingleTabGroup,
  buildSplitLayout,
  closeOtherTabs,
  focusNextTab,
  focusPane,
  focusPreviousTab,
  focusTab,
  getActiveTab,
  getFocusedPane,
  getPaneBySessionId,
  isAgentSession,
  isEditorSession,
  removePaneFromLayout,
  revealSessionInTabGroup,
  removeTab,
  renameTab,
  replacePaneRef,
  resizeAdjacentPanes,
  resizePanes,
  updateTabLayout,
  type StageLayout,
  type StageLayoutOrientation,
  type StagePane,
  type StagePaneId,
  type StagePaneRef,
  type StageTab,
  type StageTabGroup,
  type StageTabId,
  type WorkspaceSession,
} from "../../entities";
import { createDebouncedTask } from "../../shared";
import {
  clearPersistedStageTabGroup,
  loadPersistedStageTabGroup,
  savePersistedStageTabGroup,
} from "../api/stageLayoutPersistence.api";

const STAGE_LAYOUT_PERSISTENCE_DEBOUNCE_MS = 250;

interface UseStageTabGroupParams {
  workspaceSessions: Map<string, WorkspaceSession>;
  activeSessionId: string | null;
  setActiveSessionId: Dispatch<SetStateAction<string | null>>;
  isRestoreReady: boolean;
  restoreTabsOnRestart: boolean;
  maxStageTabs: number;
}

interface UseStageTabGroupResult {
  tabGroup: StageTabGroup | null;
  activeTab: StageTab | null;
  layout: StageLayout | null;
  focusedPane: StagePane | null;
  handleCreateTab: () => boolean;
  handleCreateTabWithRef: (ref: StagePaneRef) => boolean;
  handleCloseTab: (tabId: StageTabId) => void;
  handleCloseOtherTabs: (tabId: StageTabId) => void;
  handleFocusTab: (tabId: StageTabId) => void;
  handleRenameTab: (tabId: StageTabId, label: string) => void;
  handleFocusNextTab: () => void;
  handleFocusPreviousTab: () => void;
  handleSelectSession: (sessionId: string) => boolean;
  handleRevealSession: (sessionId: string) => boolean;
  handleFocusPane: (paneId: StagePaneId) => void;
  handleSplitPane: (orientation: StageLayoutOrientation, ref?: StagePaneRef) => void;
  handleReplacePaneRef: (paneId: StagePaneId, ref: StagePaneRef) => void;
  handleResizePanes: (paneSizes: number[]) => void;
  handleResizeAdjacentPanes: (dividerIndex: number, deltaRatio: number) => void;
  handleClosePane: (paneId: StagePaneId) => void;
  handleCloseFocusedPane: () => void;
  handleResetToSinglePane: (sessionId?: string | null) => void;
  focusNextPane: () => void;
  focusPreviousPane: () => void;
}

function buildStagePaneRef(session: WorkspaceSession | null | undefined): StagePaneRef | null {
  if (!session) {
    return null;
  }

  return isAgentSession(session)
    ? { kind: "agent", sessionId: session.id }
    : isEditorSession(session)
      ? { kind: "editor", sessionId: session.id }
      : { kind: "terminal", sessionId: session.id };
}

function getSessionIdFromPane(pane: StagePane | null): string | null {
  if (!pane || pane.ref.kind === "pending") {
    return null;
  }

  return pane.ref.sessionId;
}

function getActiveFocusedSessionId(group: StageTabGroup | null): string | null {
  if (!group || group.tabs.length === 0) {
    return null;
  }

  return getSessionIdFromPane(getFocusedPane(getActiveTab(group).layout));
}

function getFocusedSessionIdFromLayout(layout: StageLayout): string | null {
  return getSessionIdFromPane(getFocusedPane(layout));
}

function resolvePendingRef(
  ref: StagePaneRef,
  sourceSessionId: string | null,
): StagePaneRef {
  if (ref.kind !== "pending") {
    return ref;
  }

  const nextSourceSessionId = ref.sourceSessionId ?? sourceSessionId ?? undefined;

  return nextSourceSessionId
    ? { kind: "pending", sourceSessionId: nextSourceSessionId }
    : { kind: "pending" };
}

function pruneTabGroupSessions(
  group: StageTabGroup | null,
  workspaceSessions: Map<string, WorkspaceSession>,
): StageTabGroup | null {
  if (!group) {
    return null;
  }

  let nextGroup = group;
  let changed = false;

  for (const tab of group.tabs) {
    let nextLayout: StageLayout | null = tab.layout;

    for (const pane of tab.layout.panes) {
      if (pane.ref.kind === "pending" || workspaceSessions.has(pane.ref.sessionId)) {
        continue;
      }

      nextLayout = nextLayout ? removePaneFromLayout(nextLayout, pane.id) : null;
      changed = true;
      if (!nextLayout) {
        break;
      }
    }

    if (!nextLayout) {
      const trimmedGroup = removeTab(nextGroup, tab.id);
      if (!trimmedGroup) {
        return null;
      }
      nextGroup = trimmedGroup;
      continue;
    }

    if (nextLayout !== tab.layout) {
      nextGroup = updateTabLayout(nextGroup, tab.id, nextLayout);
    }
  }

  return changed ? nextGroup : group;
}

function routeSessionIntoActiveTab(
  group: StageTabGroup | null,
  sessionId: string,
  ref: StagePaneRef,
): StageTabGroup {
  if (!group) {
    return buildSingleTabGroup(ref);
  }

  const activeTab = getActiveTab(group);
  const existingPane = getPaneBySessionId(activeTab.layout, sessionId);
  const nextLayout = existingPane
    ? focusPane(activeTab.layout, existingPane.id)
    : replacePaneRef(activeTab.layout, activeTab.layout.focusedPaneId, ref);

  return nextLayout === activeTab.layout
    ? group
    : updateTabLayout(group, activeTab.id, nextLayout);
}

export function useStageTabGroup({
  workspaceSessions,
  activeSessionId,
  setActiveSessionId,
  isRestoreReady,
  restoreTabsOnRestart,
  maxStageTabs,
}: UseStageTabGroupParams): UseStageTabGroupResult {
  const [tabGroupState, setTabGroupState] = useState<StageTabGroup | null>(null);
  const tabGroupRef = useRef<StageTabGroup | null>(tabGroupState);
  const hasRestoredLayoutRef = useRef(false);
  const pendingPersistRef = useRef({
    tabGroup: tabGroupState,
    restoreTabsOnRestart,
  });
  const persistTaskRef = useRef(createDebouncedTask(() => {
    const pending = pendingPersistRef.current;
    if (!pending.restoreTabsOnRestart) {
      clearPersistedStageTabGroup();
      return;
    }

    savePersistedStageTabGroup(pending.tabGroup);
  }, STAGE_LAYOUT_PERSISTENCE_DEBOUNCE_MS));

  const setTabGroup = useCallback((nextTabGroup: StageTabGroup | null) => {
    tabGroupRef.current = nextTabGroup;
    setTabGroupState(nextTabGroup);
  }, []);

  const commitTabGroup = useCallback((nextTabGroup: StageTabGroup | null, nextActiveSessionId?: string | null) => {
    setTabGroup(nextTabGroup);
    if (nextActiveSessionId !== undefined) {
      setActiveSessionId(nextActiveSessionId);
    }
  }, [setActiveSessionId, setTabGroup]);

  pendingPersistRef.current = {
    tabGroup: tabGroupState,
    restoreTabsOnRestart,
  };

  useEffect(() => {
    const persistTask = persistTaskRef.current;
    return () => {
      persistTask.flush();
      persistTask.cancel();
    };
  }, []);

  useEffect(() => {
    if (hasRestoredLayoutRef.current || (restoreTabsOnRestart && !isRestoreReady)) {
      return;
    }
    hasRestoredLayoutRef.current = true;

    if (!restoreTabsOnRestart) {
      clearPersistedStageTabGroup();
      return;
    }

    const restoredGroup = loadPersistedStageTabGroup();
    if (restoredGroup) {
      commitTabGroup(restoredGroup, getActiveFocusedSessionId(restoredGroup));
    }
  }, [commitTabGroup, isRestoreReady, restoreTabsOnRestart]);

  useEffect(() => {
    if (!hasRestoredLayoutRef.current) {
      return;
    }

    if (!restoreTabsOnRestart) {
      persistTaskRef.current.cancel();
      clearPersistedStageTabGroup();
      return;
    }

    persistTaskRef.current.schedule();
  }, [restoreTabsOnRestart, tabGroupState]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      persistTaskRef.current.flush();
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, []);

  useEffect(() => {
    if (!hasRestoredLayoutRef.current || (restoreTabsOnRestart && !isRestoreReady)) {
      return;
    }

    const nextGroup = pruneTabGroupSessions(tabGroupRef.current, workspaceSessions);
    if (nextGroup === tabGroupRef.current) {
      return;
    }

    commitTabGroup(nextGroup, getActiveFocusedSessionId(nextGroup));
  }, [commitTabGroup, isRestoreReady, restoreTabsOnRestart, workspaceSessions]);

  useEffect(() => {
    if (!hasRestoredLayoutRef.current && restoreTabsOnRestart && !isRestoreReady) {
      return;
    }

    if (!activeSessionId) {
      return;
    }

    const nextRef = buildStagePaneRef(workspaceSessions.get(activeSessionId));
    if (!nextRef) {
      return;
    }

    const nextGroup = routeSessionIntoActiveTab(tabGroupRef.current, activeSessionId, nextRef);
    if (nextGroup === tabGroupRef.current) {
      return;
    }

    commitTabGroup(nextGroup);
  }, [activeSessionId, commitTabGroup, isRestoreReady, restoreTabsOnRestart, workspaceSessions]);

  const activeTab = useMemo(() => {
    if (!tabGroupState || tabGroupState.tabs.length === 0) {
      return null;
    }

    return getActiveTab(tabGroupState);
  }, [tabGroupState]);

  const layout = activeTab?.layout ?? null;
  const focusedPane = useMemo(() => {
    if (!layout || layout.panes.length === 0) {
      return null;
    }

    return getFocusedPane(layout);
  }, [layout]);

  const handleCreateTab = useCallback(() => {
    const currentGroup = tabGroupRef.current;
    const nextGroup = currentGroup
      ? addTab(currentGroup, maxStageTabs)
      : buildSingleTabGroup({ kind: "pending" });
    if (!nextGroup) {
      return false;
    }

    commitTabGroup(nextGroup, null);
    return true;
  }, [commitTabGroup, maxStageTabs]);

  const handleCreateTabWithRef = useCallback((ref: StagePaneRef) => {
    const currentGroup = tabGroupRef.current;
    const nextGroup = currentGroup
      ? addTabWithRef(currentGroup, ref, maxStageTabs)
      : buildSingleTabGroup(ref);
    if (!nextGroup) {
      return false;
    }

    commitTabGroup(nextGroup, ref.kind === "pending" ? null : ref.sessionId);
    return true;
  }, [commitTabGroup, maxStageTabs]);

  const handleCloseTab = useCallback((tabId: StageTabId) => {
    const currentGroup = tabGroupRef.current;
    if (!currentGroup) {
      return;
    }

    const nextGroup = removeTab(currentGroup, tabId);
    if (nextGroup === currentGroup) {
      return;
    }

    commitTabGroup(nextGroup, getActiveFocusedSessionId(nextGroup));
  }, [commitTabGroup]);

  const handleFocusTab = useCallback((tabId: StageTabId) => {
    const currentGroup = tabGroupRef.current;
    if (!currentGroup) {
      return;
    }

    const nextGroup = focusTab(currentGroup, tabId);
    if (nextGroup === currentGroup) {
      return;
    }

    commitTabGroup(nextGroup, getActiveFocusedSessionId(nextGroup));
  }, [commitTabGroup]);

  const handleCloseOtherTabs = useCallback((tabId: StageTabId) => {
    const currentGroup = tabGroupRef.current;
    if (!currentGroup) {
      return;
    }

    const nextGroup = closeOtherTabs(currentGroup, tabId);
    if (nextGroup === currentGroup) {
      return;
    }

    commitTabGroup(nextGroup, getActiveFocusedSessionId(nextGroup));
  }, [commitTabGroup]);

  const handleRenameTab = useCallback((tabId: StageTabId, label: string) => {
    const currentGroup = tabGroupRef.current;
    if (!currentGroup) {
      return;
    }

    const nextGroup = renameTab(currentGroup, tabId, label);
    if (nextGroup === currentGroup) {
      return;
    }

    commitTabGroup(nextGroup);
  }, [commitTabGroup]);

  const handleFocusNextTab = useCallback(() => {
    const currentGroup = tabGroupRef.current;
    if (!currentGroup) {
      return;
    }

    const nextGroup = focusNextTab(currentGroup);
    if (nextGroup === currentGroup) {
      return;
    }

    commitTabGroup(nextGroup, getActiveFocusedSessionId(nextGroup));
  }, [commitTabGroup]);

  const handleFocusPreviousTab = useCallback(() => {
    const currentGroup = tabGroupRef.current;
    if (!currentGroup) {
      return;
    }

    const nextGroup = focusPreviousTab(currentGroup);
    if (nextGroup === currentGroup) {
      return;
    }

    commitTabGroup(nextGroup, getActiveFocusedSessionId(nextGroup));
  }, [commitTabGroup]);

  const handleSelectSession = useCallback((sessionId: string): boolean => {
    const nextRef = buildStagePaneRef(workspaceSessions.get(sessionId));
    if (!nextRef) {
      return false;
    }

    const nextGroup = routeSessionIntoActiveTab(tabGroupRef.current, sessionId, nextRef);
    commitTabGroup(nextGroup, sessionId);
    return true;
  }, [commitTabGroup, workspaceSessions]);

  const handleRevealSession = useCallback((sessionId: string): boolean => {
    const currentGroup = tabGroupRef.current;
    if (!currentGroup) {
      return false;
    }

    const nextGroup = revealSessionInTabGroup(currentGroup, sessionId);
    if (!nextGroup) {
      return false;
    }

    commitTabGroup(nextGroup, sessionId);
    return true;
  }, [commitTabGroup]);

  const handleFocusPane = useCallback((paneId: StagePaneId) => {
    const currentGroup = tabGroupRef.current;
    if (!currentGroup) {
      return;
    }

    const currentTab = getActiveTab(currentGroup);
    const pane = currentTab.layout.panes.find((item) => item.id === paneId) ?? null;
    if (!pane) {
      return;
    }

    const nextLayout = focusPane(currentTab.layout, paneId);
    if (nextLayout === currentTab.layout) {
      if (pane.ref.kind !== "pending") {
        setActiveSessionId(pane.ref.sessionId);
      } else {
        setActiveSessionId(null);
      }
      return;
    }

    commitTabGroup(
      updateTabLayout(currentGroup, currentTab.id, nextLayout),
      getSessionIdFromPane(pane),
    );
  }, [commitTabGroup, setActiveSessionId]);

  const handleSplitPane = useCallback((orientation: StageLayoutOrientation, ref: StagePaneRef = { kind: "pending" }) => {
    const currentGroup = tabGroupRef.current;
    if (!currentGroup) {
      const activeRef = buildStagePaneRef(activeSessionId ? workspaceSessions.get(activeSessionId) : null);
      if (activeRef) {
        const nextRef = resolvePendingRef(ref, activeSessionId);
        const singleTabGroup = buildSingleTabGroup(activeRef);
        const singleTab = getActiveTab(singleTabGroup);
        commitTabGroup(
          updateTabLayout(singleTabGroup, singleTab.id, buildSplitLayout(singleTab.layout, nextRef, orientation)),
          nextRef.kind === "pending" ? null : nextRef.sessionId,
        );
        return;
      }

      if (ref.kind !== "pending") {
        commitTabGroup(buildSingleTabGroup(ref), ref.sessionId);
      }
      return;
    }

    const currentTab = getActiveTab(currentGroup);
    const currentFocusedPane = getFocusedPane(currentTab.layout);
    const sourceSessionId = currentFocusedPane.ref.kind === "pending"
      ? currentFocusedPane.ref.sourceSessionId ?? null
      : currentFocusedPane.ref.sessionId;
    const nextRef = resolvePendingRef(ref, sourceSessionId);
    const nextLayout = buildSplitLayout(currentTab.layout, nextRef, orientation);
    if (nextLayout === currentTab.layout) {
      setActiveSessionId(getFocusedSessionIdFromLayout(currentTab.layout));
      return;
    }

    commitTabGroup(
      updateTabLayout(currentGroup, currentTab.id, nextLayout),
      getFocusedSessionIdFromLayout(nextLayout),
    );
  }, [activeSessionId, commitTabGroup, setActiveSessionId, workspaceSessions]);

  const handleReplacePaneRef = useCallback((paneId: StagePaneId, ref: StagePaneRef) => {
    const currentGroup = tabGroupRef.current;
    if (!currentGroup) {
      return;
    }

    const currentTab = getActiveTab(currentGroup);
    const nextLayout = replacePaneRef(currentTab.layout, paneId, ref);
    if (nextLayout === currentTab.layout) {
      setActiveSessionId(getFocusedSessionIdFromLayout(currentTab.layout));
      return;
    }

    commitTabGroup(
      updateTabLayout(currentGroup, currentTab.id, nextLayout),
      getFocusedSessionIdFromLayout(nextLayout),
    );
  }, [commitTabGroup, setActiveSessionId]);

  const handleResizeLayoutPanes = useCallback((paneSizes: number[]) => {
    const currentGroup = tabGroupRef.current;
    if (!currentGroup) {
      return;
    }

    const currentTab = getActiveTab(currentGroup);
    const nextLayout = resizePanes(currentTab.layout, paneSizes);
    if (nextLayout === currentTab.layout) {
      return;
    }

    commitTabGroup(updateTabLayout(currentGroup, currentTab.id, nextLayout));
  }, [commitTabGroup]);

  const handleResizeAdjacentLayoutPanes = useCallback((dividerIndex: number, deltaRatio: number) => {
    const currentGroup = tabGroupRef.current;
    if (!currentGroup) {
      return;
    }

    const currentTab = getActiveTab(currentGroup);
    const nextLayout = resizeAdjacentPanes(currentTab.layout, dividerIndex, deltaRatio);
    if (nextLayout === currentTab.layout) {
      return;
    }

    commitTabGroup(updateTabLayout(currentGroup, currentTab.id, nextLayout));
  }, [commitTabGroup]);

  const handleClosePane = useCallback((paneId: StagePaneId) => {
    const currentGroup = tabGroupRef.current;
    if (!currentGroup) {
      return;
    }

    const currentTab = getActiveTab(currentGroup);
    const nextLayout = removePaneFromLayout(currentTab.layout, paneId);
    if (nextLayout === currentTab.layout) {
      return;
    }

    if (!nextLayout) {
      const nextGroup = removeTab(currentGroup, currentTab.id);
      commitTabGroup(nextGroup, getActiveFocusedSessionId(nextGroup));
      return;
    }

    commitTabGroup(
      updateTabLayout(currentGroup, currentTab.id, nextLayout),
      getSessionIdFromPane(getFocusedPane(nextLayout)),
    );
  }, [commitTabGroup]);

  const handleCloseFocusedPane = useCallback(() => {
    const currentGroup = tabGroupRef.current;
    if (!currentGroup) {
      return;
    }

    const currentTab = getActiveTab(currentGroup);
    const currentFocusedPane = currentTab.layout.panes.find((pane) => pane.id === currentTab.layout.focusedPaneId) ?? null;
    if (!currentFocusedPane) {
      return;
    }

    handleClosePane(currentFocusedPane.id);
  }, [handleClosePane]);

  const handleResetToSinglePane = useCallback((sessionId?: string | null) => {
    const currentGroup = tabGroupRef.current;
    const nextSessionId = sessionId ?? activeSessionId;
    const nextRef = buildStagePaneRef(nextSessionId ? workspaceSessions.get(nextSessionId) : null) ?? { kind: "pending" };

    if (!currentGroup) {
      commitTabGroup(buildSingleTabGroup(nextRef), nextRef.kind === "pending" ? null : nextRef.sessionId);
      return;
    }

    const currentTab = getActiveTab(currentGroup);
    const nextLayout = buildSinglePaneLayout(nextRef);
    commitTabGroup(
      updateTabLayout(currentGroup, currentTab.id, nextLayout),
      nextRef.kind === "pending" ? null : nextRef.sessionId,
    );
  }, [activeSessionId, commitTabGroup, workspaceSessions]);

  const focusAdjacentPane = useCallback((direction: "next" | "previous") => {
    const currentGroup = tabGroupRef.current;
    if (!currentGroup) {
      return;
    }

    const currentTab = getActiveTab(currentGroup);
    if (currentTab.layout.panes.length <= 1) {
      return;
    }

    const currentIndex = currentTab.layout.panes.findIndex((pane) => pane.id === currentTab.layout.focusedPaneId);
    if (currentIndex < 0) {
      return;
    }

    const nextIndex = direction === "next"
      ? (currentIndex + 1) % currentTab.layout.panes.length
      : (currentIndex - 1 + currentTab.layout.panes.length) % currentTab.layout.panes.length;
    const nextPane = currentTab.layout.panes[nextIndex] ?? null;
    if (!nextPane) {
      return;
    }

    const nextLayout = focusPane(currentTab.layout, nextPane.id);
    commitTabGroup(
      nextLayout === currentTab.layout
        ? currentGroup
        : updateTabLayout(currentGroup, currentTab.id, nextLayout),
      getSessionIdFromPane(nextPane),
    );
  }, [commitTabGroup]);

  return {
    tabGroup: tabGroupState,
    activeTab,
    layout,
    focusedPane,
    handleCreateTab,
    handleCreateTabWithRef,
    handleCloseTab,
    handleCloseOtherTabs,
    handleFocusTab,
    handleRenameTab,
    handleFocusNextTab,
    handleFocusPreviousTab,
    handleSelectSession,
    handleRevealSession,
    handleFocusPane,
    handleSplitPane,
    handleReplacePaneRef,
    handleResizePanes: handleResizeLayoutPanes,
    handleResizeAdjacentPanes: handleResizeAdjacentLayoutPanes,
    handleClosePane,
    handleCloseFocusedPane,
    handleResetToSinglePane,
    focusNextPane: () => focusAdjacentPane("next"),
    focusPreviousPane: () => focusAdjacentPane("previous"),
  };
}
