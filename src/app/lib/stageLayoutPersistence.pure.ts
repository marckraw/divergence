import type {
  StageLayout,
  StageLayoutOrientation,
  StagePaneId,
  StagePaneRef,
  StageTab,
  StageTabGroup,
  StageTabId,
} from "../../entities";
import {
  getDefaultStageTabLabel,
  isStageTabId,
} from "../../entities";

export const STAGE_LAYOUT_PERSISTENCE_VERSION = 2;

interface PersistedStagePane {
  id: StagePaneId;
  ref: StagePaneRef;
}

interface PersistedStageLayoutSnapshot {
  orientation: StageLayoutOrientation;
  panes: PersistedStagePane[];
  paneSizes: number[];
  focusedPaneId: StagePaneId | null;
}

interface PersistedStageTabSnapshot {
  id: StageTabId;
  label: string;
  layout: PersistedStageLayoutSnapshot;
}

export interface PersistedStageTabGroupSnapshot {
  version: number;
  tabs: PersistedStageTabSnapshot[];
  activeTabId: StageTabId | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseOrientation(value: unknown): StageLayoutOrientation {
  return value === "horizontal" ? "horizontal" : "vertical";
}

function normalizePaneSizes(paneCount: number, paneSizes: unknown): number[] {
  if (paneCount <= 0) {
    return [];
  }

  if (!Array.isArray(paneSizes) || paneSizes.length !== paneCount) {
    return Array.from({ length: paneCount }, () => 1 / paneCount);
  }

  const sanitized = paneSizes.map((size) => {
    const nextSize = typeof size === "number" ? size : Number(size);
    return Number.isFinite(nextSize) && nextSize >= 0 ? nextSize : 0;
  });
  const total = sanitized.reduce((sum, size) => sum + size, 0);
  if (total <= 0) {
    return Array.from({ length: paneCount }, () => 1 / paneCount);
  }

  return sanitized.map((size) => size / total);
}

function parsePaneRef(value: unknown, allowPending: boolean): StagePaneRef | null {
  if (!isRecord(value)) {
    return null;
  }

  if (allowPending && value.kind === "pending") {
    const sourceSessionId = typeof value.sourceSessionId === "string" && value.sourceSessionId.trim()
      ? value.sourceSessionId
      : undefined;
    return sourceSessionId
      ? { kind: "pending", sourceSessionId }
      : { kind: "pending" };
  }

  const sessionId = typeof value.sessionId === "string" && value.sessionId.trim()
    ? value.sessionId
    : null;
  if (!sessionId) {
    return null;
  }

  if (value.kind === "terminal" || value.kind === "agent") {
    return {
      kind: value.kind,
      sessionId,
    };
  }

  return null;
}

function parsePane(
  value: unknown,
  seenIds: Set<StagePaneId>,
  allowPending: boolean,
): PersistedStagePane | null {
  if (!isRecord(value) || typeof value.id !== "string") {
    return null;
  }

  const id = value.id as StagePaneId;
  if (seenIds.has(id)) {
    return null;
  }

  const ref = parsePaneRef(value.ref, allowPending);
  if (!ref) {
    return null;
  }

  seenIds.add(id);
  return {
    id,
    ref,
  };
}

function parseLayout(input: unknown, allowPending: boolean): StageLayout | null {
  if (!isRecord(input)) {
    return null;
  }

  const seenIds = new Set<StagePaneId>();
  const rawPanes = Array.isArray(input.panes) ? input.panes : [];
  const panes = rawPanes
    .map((pane) => parsePane(pane, seenIds, allowPending))
    .filter((pane): pane is PersistedStagePane => pane !== null);

  if (panes.length === 0) {
    return null;
  }

  const fallbackFocusedPaneId = panes[0]?.id ?? null;
  const focusedPaneId = typeof input.focusedPaneId === "string" && panes.some((pane) => pane.id === input.focusedPaneId)
    ? input.focusedPaneId as StagePaneId
    : fallbackFocusedPaneId;
  if (!focusedPaneId) {
    return null;
  }

  return {
    orientation: parseOrientation(input.orientation),
    panes,
    paneSizes: normalizePaneSizes(panes.length, input.paneSizes),
    focusedPaneId,
  };
}

function parseTab(value: unknown, seenIds: Set<StageTabId>): StageTab | null {
  if (!isRecord(value) || !isStageTabId(value.id) || seenIds.has(value.id)) {
    return null;
  }

  const layout = parseLayout(value.layout, true);
  if (!layout) {
    return null;
  }

  const label = typeof value.label === "string" && value.label.trim()
    ? value.label.trim()
    : getDefaultStageTabLabel(value.id);

  seenIds.add(value.id);
  return {
    id: value.id,
    label,
    layout,
  };
}

function buildLayoutSnapshot(layout: StageLayout): PersistedStageLayoutSnapshot | null {
  if (layout.panes.length === 0) {
    return null;
  }

  const focusedPaneId = layout.panes.some((pane) => pane.id === layout.focusedPaneId)
    ? layout.focusedPaneId
    : layout.panes[0]?.id ?? null;
  if (!focusedPaneId) {
    return null;
  }

  return {
    orientation: layout.orientation,
    panes: layout.panes.map((pane) => ({
      id: pane.id,
      ref: pane.ref,
    })),
    paneSizes: normalizePaneSizes(layout.panes.length, layout.paneSizes),
    focusedPaneId,
  };
}

function buildTabSnapshot(tab: StageTab): PersistedStageTabSnapshot | null {
  const layout = buildLayoutSnapshot(tab.layout);
  if (!layout) {
    return null;
  }

  return {
    id: tab.id,
    label: tab.label.trim() || getDefaultStageTabLabel(tab.id),
    layout,
  };
}

function normalizeLegacyPersistedStageLayoutState(input: unknown): StageTabGroup | null {
  const layout = parseLayout(input, false);
  if (!layout) {
    return null;
  }

  return {
    tabs: [
      {
        id: "stage-tab-1",
        label: "Tab 1",
        layout,
      },
    ],
    activeTabId: "stage-tab-1",
  };
}

export function normalizePersistedStageLayoutState(input: unknown): StageTabGroup | null {
  if (!isRecord(input)) {
    return null;
  }

  if (input.version === 2 || Array.isArray(input.tabs)) {
    const seenIds = new Set<StageTabId>();
    const tabs = (Array.isArray(input.tabs) ? input.tabs : [])
      .map((tab) => parseTab(tab, seenIds))
      .filter((tab): tab is StageTab => tab !== null);

    if (tabs.length === 0) {
      return null;
    }

    const fallbackActiveTabId = tabs[0]?.id ?? null;
    const activeTabId = isStageTabId(input.activeTabId) && tabs.some((tab) => tab.id === input.activeTabId)
      ? input.activeTabId
      : fallbackActiveTabId;
    if (!activeTabId) {
      return null;
    }

    return {
      tabs,
      activeTabId,
    };
  }

  return normalizeLegacyPersistedStageLayoutState(input);
}

export function buildPersistedStageLayoutSnapshot(group: StageTabGroup | null): PersistedStageTabGroupSnapshot | null {
  if (!group || group.tabs.length === 0) {
    return null;
  }

  const tabs = group.tabs
    .map((tab) => buildTabSnapshot(tab))
    .filter((tab): tab is PersistedStageTabSnapshot => tab !== null);

  if (tabs.length === 0) {
    return null;
  }

  const activeTabId = tabs.some((tab) => tab.id === group.activeTabId)
    ? group.activeTabId
    : tabs[0]?.id ?? null;
  if (!activeTabId) {
    return null;
  }

  return {
    version: STAGE_LAYOUT_PERSISTENCE_VERSION,
    tabs,
    activeTabId,
  };
}
