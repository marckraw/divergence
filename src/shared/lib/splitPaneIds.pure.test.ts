import { describe, expect, it } from "vitest";
import {
  MAX_SPLIT_PANES,
  SECONDARY_SPLIT_PANE_IDS,
  SPLIT_PANE_IDS,
} from "./splitPaneIds.pure";

describe("splitPaneIds", () => {
  it("defines six supported pane ids", () => {
    expect(SPLIT_PANE_IDS).toEqual([
      "pane-1",
      "pane-2",
      "pane-3",
      "pane-4",
      "pane-5",
      "pane-6",
    ]);
    expect(MAX_SPLIT_PANES).toBe(6);
  });

  it("lists only secondary panes for split tmux helpers", () => {
    expect(SECONDARY_SPLIT_PANE_IDS).toEqual([
      "pane-2",
      "pane-3",
      "pane-4",
      "pane-5",
      "pane-6",
    ]);
  });
});
