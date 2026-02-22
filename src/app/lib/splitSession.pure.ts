import type {
  SplitOrientation,
  SplitPaneId,
  SplitSessionState,
} from "../../entities";

const ALL_PANES: SplitPaneId[] = ["pane-1", "pane-2", "pane-3"];

export const MAX_SPLIT_PANES = ALL_PANES.length;

function getFirstMissingPaneId(paneIds: SplitPaneId[]): SplitPaneId | null {
  for (const paneId of ALL_PANES) {
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

  return {
    orientation,
    paneIds,
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

  const primaryPaneId = paneIds.includes(current.primaryPaneId)
    ? current.primaryPaneId
    : paneIds[0];
  const focusedPaneId = paneIds.includes(current.focusedPaneId)
    ? current.focusedPaneId
    : primaryPaneId;

  return {
    ...current,
    paneIds,
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
