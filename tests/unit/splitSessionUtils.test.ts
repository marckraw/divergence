import { describe, expect, it } from "vitest";
import {
  buildNextSplitState,
  closeFocusedSplitPane,
  focusSplitPane,
  isDefaultSinglePaneState,
  MAX_SPLIT_PANES,
} from "../../src/app/lib/splitSession.pure";

describe("split session utils", () => {
  it("creates split state and caps at max panes", () => {
    const first = buildNextSplitState(null, "vertical");
    expect(first.paneIds).toEqual(["pane-1", "pane-2"]);
    expect(first.focusedPaneId).toBe("pane-2");
    expect(first.primaryPaneId).toBe("pane-1");

    const second = buildNextSplitState(first, "vertical");
    expect(second.paneIds).toEqual(["pane-1", "pane-2", "pane-3"]);
    expect(second.paneIds).toHaveLength(MAX_SPLIT_PANES);

    const third = buildNextSplitState(second, "horizontal");
    expect(third.paneIds).toEqual(["pane-1", "pane-2", "pane-3"]);
    expect(third.orientation).toBe("horizontal");
  });

  it("tracks focus and closes focused pane", () => {
    const start = buildNextSplitState(
      buildNextSplitState(null, "vertical"),
      "vertical",
    );
    const focused = focusSplitPane(start, "pane-2");
    expect(focused.focusedPaneId).toBe("pane-2");

    const afterClose = closeFocusedSplitPane(focused);
    expect(afterClose?.paneIds).toEqual(["pane-1", "pane-3"]);
    expect(afterClose?.focusedPaneId).toBe("pane-1");
  });

  it("identifies default single-pane state", () => {
    const singleDefault = {
      orientation: "vertical" as const,
      paneIds: ["pane-1"] as const,
      focusedPaneId: "pane-1" as const,
      primaryPaneId: "pane-1" as const,
    };
    expect(isDefaultSinglePaneState(singleDefault)).toBe(true);
    expect(isDefaultSinglePaneState({ ...singleDefault, paneIds: ["pane-2"] })).toBe(false);
  });
});
