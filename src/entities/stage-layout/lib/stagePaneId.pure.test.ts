import { describe, expect, it } from "vitest";
import {
  MAX_STAGE_PANES,
  STAGE_PANE_IDS,
} from "./stagePaneId.pure";

describe("stagePaneId", () => {
  it("defines four supported stage pane ids", () => {
    expect(STAGE_PANE_IDS).toEqual([
      "stage-pane-1",
      "stage-pane-2",
      "stage-pane-3",
      "stage-pane-4",
    ]);
    expect(MAX_STAGE_PANES).toBe(4);
  });
});
