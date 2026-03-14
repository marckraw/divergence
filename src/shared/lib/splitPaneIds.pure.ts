export const SPLIT_PANE_IDS = [
  "pane-1",
  "pane-2",
  "pane-3",
  "pane-4",
  "pane-5",
  "pane-6",
] as const;

export type SplitPaneId = (typeof SPLIT_PANE_IDS)[number];

export const SECONDARY_SPLIT_PANE_IDS: readonly SplitPaneId[] = SPLIT_PANE_IDS.filter(
  (paneId) => paneId !== "pane-1"
);

export const MAX_SPLIT_PANES = SPLIT_PANE_IDS.length;
