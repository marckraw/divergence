import type { StageLayout } from "./stageLayout.types";
import type { StageTabId } from "../lib/stageTabId.pure";

export interface StageTab {
  id: StageTabId;
  label: string;
  layout: StageLayout;
}

export interface StageTabGroup {
  tabs: StageTab[];
  activeTabId: StageTabId;
}
