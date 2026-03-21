import type { StageLayout } from "../../entities";
import {
  buildPersistedStageLayoutSnapshot,
  normalizePersistedStageLayoutState,
} from "../lib/stageLayoutPersistence.pure";

export const STAGE_LAYOUT_STORAGE_KEY = "divergence-stage-layout";

export function loadPersistedStageLayoutState(): StageLayout | null {
  try {
    const raw = localStorage.getItem(STAGE_LAYOUT_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    return normalizePersistedStageLayoutState(JSON.parse(raw));
  } catch (error) {
    console.warn("Failed to load persisted stage layout", error);
    return null;
  }
}

export function savePersistedStageLayoutState(layout: StageLayout | null): void {
  const snapshot = buildPersistedStageLayoutSnapshot(layout);
  if (!snapshot) {
    localStorage.removeItem(STAGE_LAYOUT_STORAGE_KEY);
    return;
  }

  localStorage.setItem(STAGE_LAYOUT_STORAGE_KEY, JSON.stringify(snapshot));
}

export function clearPersistedStageLayoutState(): void {
  localStorage.removeItem(STAGE_LAYOUT_STORAGE_KEY);
}
