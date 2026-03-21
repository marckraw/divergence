import {
  MAX_STAGE_PANES,
  STAGE_PANE_IDS,
  type StagePaneId,
} from "./stagePaneId.pure";
import type {
  StageLayout,
  StageLayoutOrientation,
  StagePane,
  StagePaneRef,
} from "../model/stageLayout.types";

const DEFAULT_ORIENTATION: StageLayoutOrientation = "vertical";
const SIZE_EPSILON = 0.001;
const MIN_PANE_SIZE = 0.15;

function buildEqualPaneSizes(paneCount: number): number[] {
  if (paneCount <= 0) {
    return [];
  }

  return Array.from({ length: paneCount }, () => 1 / paneCount);
}

function normalizePaneSizes(paneCount: number, paneSizes: number[] | null | undefined): number[] {
  if (paneCount <= 0) {
    return [];
  }

  if (!paneSizes || paneSizes.length !== paneCount) {
    return buildEqualPaneSizes(paneCount);
  }

  const sanitized = paneSizes.map((size) => (Number.isFinite(size) && size >= 0 ? size : 0));
  const total = sanitized.reduce((sum, size) => sum + size, 0);
  if (total <= 0) {
    return buildEqualPaneSizes(paneCount);
  }

  return sanitized.map((size) => size / total);
}

function arePaneSizesEqual(left: number[], right: number[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((size, index) => Math.abs(size - (right[index] ?? 0)) <= SIZE_EPSILON);
}

function getNextPaneId(panes: StagePane[]): StagePaneId | null {
  const usedIds = new Set(panes.map((pane) => pane.id));
  for (const paneId of STAGE_PANE_IDS) {
    if (!usedIds.has(paneId)) {
      return paneId;
    }
  }
  return null;
}

function getPaneIndex(layout: StageLayout, paneId: StagePaneId): number {
  return layout.panes.findIndex((pane) => pane.id === paneId);
}

function getFallbackFocusedPaneId(layout: StageLayout, removedPaneIndex: number): StagePaneId {
  const nextIndex = Math.max(0, Math.min(removedPaneIndex, layout.panes.length - 1));
  return layout.panes[nextIndex]?.id ?? layout.panes[0].id;
}

export function buildSinglePaneLayout(ref: StagePaneRef): StageLayout {
  return {
    orientation: DEFAULT_ORIENTATION,
    panes: [
      {
        id: "stage-pane-1",
        ref,
      },
    ],
    paneSizes: [1],
    focusedPaneId: "stage-pane-1",
  };
}

export function buildSplitLayout(
  current: StageLayout,
  newRef: StagePaneRef,
  orientation: StageLayoutOrientation,
): StageLayout {
  if (current.panes.length === 0) {
    return buildSinglePaneLayout(newRef);
  }

  if (current.panes.length >= MAX_STAGE_PANES) {
    if (current.orientation === orientation) {
      return current;
    }

    return {
      ...current,
      orientation,
    };
  }

  const nextPaneId = getNextPaneId(current.panes);
  if (!nextPaneId) {
    return current;
  }

  const panes = [
    ...current.panes,
    {
      id: nextPaneId,
      ref: newRef,
    },
  ];

  return {
    orientation,
    panes,
    paneSizes: buildEqualPaneSizes(panes.length),
    focusedPaneId: nextPaneId,
  };
}

export function removePaneFromLayout(current: StageLayout, paneId: StagePaneId): StageLayout | null {
  const removedPaneIndex = getPaneIndex(current, paneId);
  if (removedPaneIndex < 0) {
    return current;
  }

  const normalizedPaneSizes = normalizePaneSizes(current.panes.length, current.paneSizes);
  const remainingPanes = current.panes.filter((pane) => pane.id !== paneId);
  if (remainingPanes.length === 0) {
    return null;
  }

  const paneSizeById = new Map<StagePaneId, number>(
    current.panes.map((pane, index) => [pane.id, normalizedPaneSizes[index] ?? 0]),
  );
  const nextLayout: StageLayout = {
    orientation: current.orientation,
    panes: remainingPanes,
    paneSizes: normalizePaneSizes(
      remainingPanes.length,
      remainingPanes.map((pane) => paneSizeById.get(pane.id) ?? 0),
    ),
    focusedPaneId: remainingPanes.some((pane) => pane.id === current.focusedPaneId)
      ? current.focusedPaneId
      : getFallbackFocusedPaneId(
        {
          ...current,
          panes: remainingPanes,
        },
        removedPaneIndex,
      ),
  };

  return nextLayout;
}

export function focusPane(current: StageLayout, paneId: StagePaneId): StageLayout {
  if (!current.panes.some((pane) => pane.id === paneId) || current.focusedPaneId === paneId) {
    return current;
  }

  return {
    ...current,
    focusedPaneId: paneId,
  };
}

export function resizePanes(current: StageLayout, paneSizes: number[]): StageLayout {
  const nextPaneSizes = normalizePaneSizes(current.panes.length, paneSizes);
  if (arePaneSizesEqual(normalizePaneSizes(current.panes.length, current.paneSizes), nextPaneSizes)) {
    return current;
  }

  return {
    ...current,
    paneSizes: nextPaneSizes,
  };
}

export function resizeAdjacentPanes(
  current: StageLayout,
  dividerIndex: number,
  deltaRatio: number,
  minPaneSize = MIN_PANE_SIZE,
): StageLayout {
  if (dividerIndex < 0 || dividerIndex >= current.panes.length - 1) {
    return current;
  }

  const currentSizes = normalizePaneSizes(current.panes.length, current.paneSizes);
  const leftSize = currentSizes[dividerIndex] ?? 0;
  const rightSize = currentSizes[dividerIndex + 1] ?? 0;
  const combined = leftSize + rightSize;
  const nextLeft = Math.min(Math.max(leftSize + deltaRatio, minPaneSize), combined - minPaneSize);
  const nextRight = combined - nextLeft;

  const nextSizes = [...currentSizes];
  nextSizes[dividerIndex] = nextLeft;
  nextSizes[dividerIndex + 1] = nextRight;
  return resizePanes(current, nextSizes);
}

export function replacePaneRef(current: StageLayout, paneId: StagePaneId, ref: StagePaneRef): StageLayout {
  let changed = false;
  const panes = current.panes.map((pane) => {
    if (pane.id !== paneId) {
      return pane;
    }

    const isSameTerminal = pane.ref.kind === "terminal" && ref.kind === "terminal" && pane.ref.sessionId === ref.sessionId;
    const isSameAgent = pane.ref.kind === "agent" && ref.kind === "agent" && pane.ref.sessionId === ref.sessionId;
    const isSamePending = pane.ref.kind === "pending" && ref.kind === "pending";
    if (isSameTerminal || isSameAgent || isSamePending) {
      return pane;
    }

    changed = true;
    return {
      ...pane,
      ref,
    };
  });

  if (!changed) {
    return current;
  }

  return {
    ...current,
    panes,
    focusedPaneId: panes.some((pane) => pane.id === paneId) ? paneId : current.focusedPaneId,
  };
}

export function getFocusedPane(layout: StageLayout): StagePane {
  return layout.panes.find((pane) => pane.id === layout.focusedPaneId) ?? layout.panes[0];
}

export function getPaneBySessionId(layout: StageLayout, sessionId: string): StagePane | null {
  return layout.panes.find((pane) => {
    if (pane.ref.kind === "pending") {
      return false;
    }

    return pane.ref.sessionId === sessionId;
  }) ?? null;
}

export function isSinglePane(layout: StageLayout): boolean {
  return layout.panes.length <= 1;
}
