import {
  buildEqualSplitPaneSizes,
  MAX_SPLIT_PANES,
  normalizeSplitPaneSizes,
  SPLIT_PANE_IDS,
} from "../../entities";
import type {
  SplitOrientation,
  SplitPaneId,
  SplitSessionState,
} from "../../entities";

function getFirstMissingPaneId(paneIds: SplitPaneId[]): SplitPaneId | null {
  for (const paneId of SPLIT_PANE_IDS) {
    if (!paneIds.includes(paneId)) {
      return paneId;
    }
  }
  return null;
}

export function buildNextSplitState(
  current: SplitSessionState | null | undefined,
  orientation: SplitOrientation,
): SplitSessionState {
  if (!current) {
    return {
      orientation,
      paneIds: ["pane-1", "pane-2"],
      paneSizes: [0.5, 0.5],
      focusedPaneId: "pane-2",
      primaryPaneId: "pane-1",
    };
  }

  let paneIds = current.paneIds;
  let focusedPaneId = current.focusedPaneId;

  if (paneIds.length < MAX_SPLIT_PANES) {
    const nextPaneId = getFirstMissingPaneId(paneIds);
    if (nextPaneId) {
      paneIds = [...paneIds, nextPaneId];
      focusedPaneId = nextPaneId;
    }
  }

  const primaryPaneId = paneIds.includes(current.primaryPaneId)
    ? current.primaryPaneId
    : paneIds[0];
  const paneSizes = paneIds.length === current.paneIds.length
    ? normalizeSplitPaneSizes(paneIds.length, current.paneSizes)
    : buildEqualSplitPaneSizes(paneIds.length);

  return {
    orientation,
    paneIds,
    paneSizes,
    focusedPaneId: paneIds.includes(focusedPaneId) ? focusedPaneId : primaryPaneId,
    primaryPaneId,
  };
}

export function focusSplitPane(
  current: SplitSessionState,
  paneId: SplitPaneId,
): SplitSessionState {
  if (!current.paneIds.includes(paneId) || current.focusedPaneId === paneId) {
    return current;
  }
  return {
    ...current,
    focusedPaneId: paneId,
  };
}

export function closeFocusedSplitPane(
  current: SplitSessionState,
): SplitSessionState | null {
  if (current.paneIds.length === 0) {
    return null;
  }

  const paneToClose = current.paneIds.includes(current.focusedPaneId)
    ? current.focusedPaneId
    : current.paneIds[current.paneIds.length - 1];

  const paneIds = current.paneIds.filter((paneId) => paneId !== paneToClose);
  if (paneIds.length === 0) {
    return null;
  }
  const normalizedPaneSizes = normalizeSplitPaneSizes(current.paneIds.length, current.paneSizes);
  const paneSizeByPaneId = new Map<SplitPaneId, number>(
    current.paneIds.map((paneId, index) => [paneId, normalizedPaneSizes[index] ?? 0])
  );
  const paneSizes = normalizeSplitPaneSizes(
    paneIds.length,
    paneIds.map((paneId) => paneSizeByPaneId.get(paneId) ?? 0)
  );

  const primaryPaneId = paneIds.includes(current.primaryPaneId)
    ? current.primaryPaneId
    : paneIds[0];
  const focusedPaneId = paneIds.includes(current.focusedPaneId)
    ? current.focusedPaneId
    : primaryPaneId;

  return {
    ...current,
    paneIds,
    paneSizes,
    primaryPaneId,
    focusedPaneId,
  };
}

export function focusNextSplitPane(
  current: SplitSessionState,
): SplitSessionState {
  if (current.paneIds.length <= 1) {
    return current;
  }
  const currentIndex = current.paneIds.indexOf(current.focusedPaneId);
  const nextIndex = currentIndex < current.paneIds.length - 1 ? currentIndex + 1 : 0;
  return {
    ...current,
    focusedPaneId: current.paneIds[nextIndex],
  };
}

export function focusPreviousSplitPane(
  current: SplitSessionState,
): SplitSessionState {
  if (current.paneIds.length <= 1) {
    return current;
  }
  const currentIndex = current.paneIds.indexOf(current.focusedPaneId);
  const prevIndex = currentIndex > 0 ? currentIndex - 1 : current.paneIds.length - 1;
  return {
    ...current,
    focusedPaneId: current.paneIds[prevIndex],
  };
}

export function isDefaultSinglePaneState(
  state: SplitSessionState,
): boolean {
  return state.paneIds.length === 1 && state.paneIds[0] === "pane-1";
}
