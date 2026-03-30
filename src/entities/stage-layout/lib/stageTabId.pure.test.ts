import { describe, expect, it } from "vitest";
import {
  MAX_STAGE_TABS,
  STAGE_TAB_IDS,
  getDefaultStageTabLabel,
  getStageTabOrdinal,
  isDefaultStageTabLabel,
  isStageTabId,
} from "./stageTabId.pure";

describe("stageTabId", () => {
  it("defines the fixed layout-tab ids and max count", () => {
    expect(STAGE_TAB_IDS).toHaveLength(20);
    expect(STAGE_TAB_IDS[0]).toBe("stage-tab-1");
    expect(STAGE_TAB_IDS[19]).toBe("stage-tab-20");
    expect(MAX_STAGE_TABS).toBe(20);
  });

  it("validates tab ids and derives the default label metadata", () => {
    expect(isStageTabId("stage-tab-1")).toBe(true);
    expect(isStageTabId("stage-tab-9")).toBe(true);
    expect(isStageTabId("stage-tab-20")).toBe(true);
    expect(isStageTabId("stage-tab-21")).toBe(false);
    expect(isStageTabId("tab-1")).toBe(false);
    expect(getStageTabOrdinal("stage-tab-3")).toBe(3);
    expect(getDefaultStageTabLabel("stage-tab-3")).toBe("Tab 3");
    expect(isDefaultStageTabLabel("stage-tab-3", "Tab 3")).toBe(true);
    expect(isDefaultStageTabLabel("stage-tab-3", "PR Review")).toBe(false);
  });
});
