import { buildSinglePaneLayout, focusPane, getFocusedPane, getPaneBySessionId } from "./stageLayout.pure";
import type { StageLayout, StagePaneRef } from "../model/stageLayout.types";
import type { StageTab, StageTabGroup } from "../model/stageTab.types";
import type { WorkspaceSession } from "../../workspace-session";
import {
  MAX_STAGE_TABS,
  STAGE_TAB_IDS,
  getDefaultStageTabLabel,
  isDefaultStageTabLabel,
  type StageTabId,
} from "./stageTabId.pure";

function buildTab(id: StageTabId, ref: StagePaneRef): StageTab {
  return {
    id,
    label: getDefaultStageTabLabel(id),
    layout: buildSinglePaneLayout(ref),
  };
}

function getTabIndex(group: StageTabGroup, tabId: StageTabId): number {
  return group.tabs.findIndex((tab) => tab.id === tabId);
}

function getFallbackActiveTabId(tabs: StageTab[], removedIndex: number): StageTabId {
  const nextIndex = Math.max(0, Math.min(removedIndex, tabs.length - 1));
  return tabs[nextIndex]?.id ?? tabs[0].id;
}

function getNextTabId(group: StageTabGroup): StageTabId | null {
  const usedIds = new Set(group.tabs.map((tab) => tab.id));
  for (const tabId of STAGE_TAB_IDS) {
    if (!usedIds.has(tabId)) {
      return tabId;
    }
  }

  return null;
}

export function buildSingleTabGroup(ref: StagePaneRef): StageTabGroup {
  const firstTabId = STAGE_TAB_IDS[0];

  return {
    tabs: [buildTab(firstTabId, ref)],
    activeTabId: firstTabId,
  };
}

export function addTab(group: StageTabGroup, maxTabs: number = MAX_STAGE_TABS): StageTabGroup | null {
  return addTabWithRef(group, { kind: "pending" }, maxTabs);
}

export function addTabWithRef(
  group: StageTabGroup,
  ref: StagePaneRef,
  maxTabs: number = MAX_STAGE_TABS,
): StageTabGroup | null {
  if (group.tabs.length >= maxTabs) {
    return null;
  }

  const nextTabId = getNextTabId(group);
  if (!nextTabId) {
    return null;
  }

  const nextTab = buildTab(nextTabId, ref);

  return {
    tabs: [...group.tabs, nextTab],
    activeTabId: nextTab.id,
  };
}

export function removeTab(group: StageTabGroup, tabId: StageTabId): StageTabGroup | null {
  const removedIndex = getTabIndex(group, tabId);
  if (removedIndex < 0) {
    return group;
  }

  const nextTabs = group.tabs.filter((tab) => tab.id !== tabId);
  if (nextTabs.length === 0) {
    return null;
  }

  return {
    tabs: nextTabs,
    activeTabId: group.activeTabId === tabId
      ? getFallbackActiveTabId(nextTabs, removedIndex)
      : group.activeTabId,
  };
}

export function closeOtherTabs(group: StageTabGroup, tabId: StageTabId): StageTabGroup {
  const activeTab = group.tabs.find((tab) => tab.id === tabId);
  if (!activeTab || group.tabs.length === 1) {
    return group;
  }

  return {
    tabs: [activeTab],
    activeTabId: activeTab.id,
  };
}

export function focusTab(group: StageTabGroup, tabId: StageTabId): StageTabGroup {
  if (group.activeTabId === tabId || !group.tabs.some((tab) => tab.id === tabId)) {
    return group;
  }

  return {
    ...group,
    activeTabId: tabId,
  };
}

function focusRelativeTab(group: StageTabGroup, direction: 1 | -1): StageTabGroup {
  if (group.tabs.length <= 1) {
    return group;
  }

  const currentIndex = getTabIndex(group, group.activeTabId);
  if (currentIndex < 0) {
    return {
      ...group,
      activeTabId: group.tabs[0].id,
    };
  }

  const nextIndex = (currentIndex + direction + group.tabs.length) % group.tabs.length;
  return focusTab(group, group.tabs[nextIndex].id);
}

export function focusNextTab(group: StageTabGroup): StageTabGroup {
  return focusRelativeTab(group, 1);
}

export function focusPreviousTab(group: StageTabGroup): StageTabGroup {
  return focusRelativeTab(group, -1);
}

export function renameTab(group: StageTabGroup, tabId: StageTabId, label: string): StageTabGroup {
  const nextLabel = label.trim();
  if (!nextLabel) {
    return group;
  }

  let changed = false;
  const nextTabs = group.tabs.map((tab) => {
    if (tab.id !== tabId || tab.label === nextLabel) {
      return tab;
    }

    changed = true;
    return {
      ...tab,
      label: nextLabel,
    };
  });

  return changed
    ? {
      ...group,
      tabs: nextTabs,
    }
    : group;
}

export function updateTabLayout(group: StageTabGroup, tabId: StageTabId, layout: StageLayout): StageTabGroup {
  let changed = false;
  const nextTabs = group.tabs.map((tab) => {
    if (tab.id !== tabId || tab.layout === layout) {
      return tab;
    }

    changed = true;
    return {
      ...tab,
      layout,
    };
  });

  return changed
    ? {
      ...group,
      tabs: nextTabs,
    }
    : group;
}

export function removeTabIfEmpty(group: StageTabGroup, tabId: StageTabId): StageTabGroup | null {
  const tab = group.tabs.find((item) => item.id === tabId);
  if (!tab || tab.layout.panes.length > 0) {
    return group;
  }

  return removeTab(group, tabId);
}

export function getActiveTab(group: StageTabGroup): StageTab {
  return group.tabs.find((tab) => tab.id === group.activeTabId) ?? group.tabs[0];
}

export function findTabBySessionId(group: StageTabGroup, sessionId: string): StageTab | null {
  return group.tabs.find((tab) => getPaneBySessionId(tab.layout, sessionId) !== null) ?? null;
}

export function revealSessionInTabGroup(group: StageTabGroup, sessionId: string): StageTabGroup | null {
  const targetTab = findTabBySessionId(group, sessionId);
  if (!targetTab) {
    return null;
  }

  const targetPane = getPaneBySessionId(targetTab.layout, sessionId);
  if (!targetPane) {
    return null;
  }

  const nextLayout = focusPane(targetTab.layout, targetPane.id);
  const nextGroup = nextLayout === targetTab.layout
    ? group
    : updateTabLayout(group, targetTab.id, nextLayout);
  return focusTab(nextGroup, targetTab.id);
}

function getStageTabPrimarySession(
  tab: StageTab,
  workspaceSessions: Map<string, WorkspaceSession>,
): WorkspaceSession | null {
  const focusedPane = getFocusedPane(tab.layout);
  if (focusedPane.ref.kind !== "pending") {
    return workspaceSessions.get(focusedPane.ref.sessionId) ?? null;
  }

  for (const pane of tab.layout.panes) {
    if (pane.ref.kind === "pending") {
      continue;
    }

    const session = workspaceSessions.get(pane.ref.sessionId);
    if (session) {
      return session;
    }
  }

  return null;
}

export function getStageTabDisplayLabel(
  tab: StageTab,
  workspaceSessions: Map<string, WorkspaceSession>,
): string {
  if (!isDefaultStageTabLabel(tab.id, tab.label)) {
    return tab.label;
  }

  const primarySession = getStageTabPrimarySession(tab, workspaceSessions);
  if (!primarySession) {
    return tab.label;
  }

  const additionalPaneCount = Math.max(0, tab.layout.panes.length - 1);
  return additionalPaneCount > 0
    ? `${primarySession.name} +${additionalPaneCount}`
    : primarySession.name;
}
