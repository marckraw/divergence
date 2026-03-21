import type {
  StageLayout,
  StageLayoutOrientation,
  StagePaneId,
  StagePaneRef,
} from "../../entities";

export const STAGE_LAYOUT_PERSISTENCE_VERSION = 1;

interface PersistedStagePane {
  id: StagePaneId;
  ref: Extract<StagePaneRef, { kind: "terminal" | "agent" }>;
}

export interface PersistedStageLayoutSnapshot {
  version: number;
  orientation: StageLayoutOrientation;
  panes: PersistedStagePane[];
  paneSizes: number[];
  focusedPaneId: StagePaneId | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parsePaneRef(value: unknown): PersistedStagePane["ref"] | null {
  if (!isRecord(value)) {
    return null;
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

function parsePane(value: unknown, seenIds: Set<StagePaneId>): PersistedStagePane | null {
  if (!isRecord(value) || typeof value.id !== "string") {
    return null;
  }

  const id = value.id as StagePaneId;
  if (seenIds.has(id)) {
    return null;
  }

  const ref = parsePaneRef(value.ref);
  if (!ref) {
    return null;
  }

  seenIds.add(id);
  return {
    id,
    ref,
  };
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

export function normalizePersistedStageLayoutState(input: unknown): StageLayout | null {
  if (!isRecord(input)) {
    return null;
  }

  const seenIds = new Set<StagePaneId>();
  const rawPanes = Array.isArray(input.panes) ? input.panes : [];
  const panes = rawPanes
    .map((pane) => parsePane(pane, seenIds))
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

export function buildPersistedStageLayoutSnapshot(layout: StageLayout | null): PersistedStageLayoutSnapshot | null {
  if (!layout) {
    return null;
  }

  const panes = layout.panes.filter((pane): pane is PersistedStagePane => (
    pane.ref.kind === "terminal" || pane.ref.kind === "agent"
  ));

  if (panes.length === 0) {
    return null;
  }

  const fallbackFocusedPaneId = panes[0]?.id ?? null;
  const focusedPaneId = panes.some((pane) => pane.id === layout.focusedPaneId)
    ? layout.focusedPaneId
    : fallbackFocusedPaneId;
  if (!focusedPaneId) {
    return null;
  }

  return {
    version: STAGE_LAYOUT_PERSISTENCE_VERSION,
    orientation: layout.orientation,
    panes,
    paneSizes: normalizePaneSizes(panes.length, layout.paneSizes),
    focusedPaneId,
  };
}
