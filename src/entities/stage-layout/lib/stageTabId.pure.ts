export const STAGE_TAB_IDS = [
  "stage-tab-1",
  "stage-tab-2",
  "stage-tab-3",
  "stage-tab-4",
  "stage-tab-5",
  "stage-tab-6",
  "stage-tab-7",
  "stage-tab-8",
  "stage-tab-9",
  "stage-tab-10",
  "stage-tab-11",
  "stage-tab-12",
  "stage-tab-13",
  "stage-tab-14",
  "stage-tab-15",
  "stage-tab-16",
  "stage-tab-17",
  "stage-tab-18",
  "stage-tab-19",
  "stage-tab-20",
] as const;

export type StageTabId = (typeof STAGE_TAB_IDS)[number];

export const MAX_STAGE_TABS = STAGE_TAB_IDS.length;

const STAGE_TAB_ID_SET = new Set<string>(STAGE_TAB_IDS);

export function isStageTabId(value: unknown): value is StageTabId {
  return typeof value === "string" && STAGE_TAB_ID_SET.has(value);
}

export function getStageTabOrdinal(tabId: StageTabId): number {
  return STAGE_TAB_IDS.indexOf(tabId) + 1;
}

export function getDefaultStageTabLabel(tabId: StageTabId): string {
  return `Tab ${getStageTabOrdinal(tabId)}`;
}
