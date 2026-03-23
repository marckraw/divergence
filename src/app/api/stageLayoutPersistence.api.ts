import type { StageTabGroup } from "../../entities";
import {
  buildPersistedStageLayoutSnapshot,
  normalizePersistedStageLayoutState,
} from "../lib/stageLayoutPersistence.pure";

export const STAGE_LAYOUT_STORAGE_KEY = "divergence-stage-layout";

export function loadPersistedStageTabGroup(): StageTabGroup | null {
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

export function savePersistedStageTabGroup(group: StageTabGroup | null): void {
  const snapshot = buildPersistedStageLayoutSnapshot(group);
  if (!snapshot) {
    localStorage.removeItem(STAGE_LAYOUT_STORAGE_KEY);
    return;
  }

  localStorage.setItem(STAGE_LAYOUT_STORAGE_KEY, JSON.stringify(snapshot));
}

export function clearPersistedStageTabGroup(): void {
  localStorage.removeItem(STAGE_LAYOUT_STORAGE_KEY);
}
