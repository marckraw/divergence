export type {
  StageLayout,
  StageLayoutAction,
  StageLayoutOrientation,
  StagePane,
  StagePaneRef,
} from "./model/stageLayout.types";
export type {
  StageTab,
  StageTabGroup,
} from "./model/stageTab.types";
export {
  MAX_STAGE_PANES,
  STAGE_PANE_IDS,
  type StagePaneId,
} from "./lib/stagePaneId.pure";
export {
  MAX_STAGE_TABS,
  STAGE_TAB_IDS,
  getDefaultStageTabLabel,
  getStageTabOrdinal,
  isStageTabId,
  type StageTabId,
} from "./lib/stageTabId.pure";
export {
  buildSinglePaneLayout,
  buildSplitLayout,
  focusPane,
  getFocusedPane,
  getPaneBySessionId,
  isSinglePane,
  removePaneFromLayout,
  replacePaneRef,
  resizeAdjacentPanes,
  resizePanes,
} from "./lib/stageLayout.pure";
export {
  addTab,
  addTabWithRef,
  buildSingleTabGroup,
  closeOtherTabs,
  findTabBySessionId,
  focusNextTab,
  focusPreviousTab,
  focusTab,
  getActiveTab,
  removeTab,
  removeTabIfEmpty,
  revealSessionInTabGroup,
  renameTab,
  updateTabLayout,
} from "./lib/stageTab.pure";
