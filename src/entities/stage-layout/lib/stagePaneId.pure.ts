export const STAGE_PANE_IDS = [
  "stage-pane-1",
  "stage-pane-2",
  "stage-pane-3",
  "stage-pane-4",
] as const;

export type StagePaneId = (typeof STAGE_PANE_IDS)[number];

export const MAX_STAGE_PANES = STAGE_PANE_IDS.length;
