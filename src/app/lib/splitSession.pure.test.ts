import { describe, expect, it } from "vitest";
import type { SplitSessionState } from "../../entities/terminal-session";
import {
  buildNextSplitState,
  closeFocusedSplitPane,
  focusNextSplitPane,
  focusPreviousSplitPane,
  focusSplitPane,
  isDefaultSinglePaneState,
  MAX_SPLIT_PANES,
} from "./splitSession.pure";

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

  it("cycles focus to next and previous pane", () => {
    const state = buildNextSplitState(
      buildNextSplitState(null, "vertical"),
      "vertical",
    );
    // state has pane-1, pane-2, pane-3 with focus on pane-3
    expect(state.paneIds).toEqual(["pane-1", "pane-2", "pane-3"]);
    expect(state.focusedPaneId).toBe("pane-3");

    // next wraps to pane-1
    const next1 = focusNextSplitPane(state);
    expect(next1.focusedPaneId).toBe("pane-1");

    // next again goes to pane-2
    const next2 = focusNextSplitPane(next1);
    expect(next2.focusedPaneId).toBe("pane-2");

    // previous from pane-2 goes to pane-1
    const prev1 = focusPreviousSplitPane(next2);
    expect(prev1.focusedPaneId).toBe("pane-1");

    // previous from pane-1 wraps to pane-3
    const prev2 = focusPreviousSplitPane(prev1);
    expect(prev2.focusedPaneId).toBe("pane-3");
  });

  it("returns same state when cycling focus with single pane", () => {
    const singlePane: SplitSessionState = {
      orientation: "vertical",
      paneIds: ["pane-1"],
      focusedPaneId: "pane-1",
      primaryPaneId: "pane-1",
    };
    expect(focusNextSplitPane(singlePane)).toBe(singlePane);
    expect(focusPreviousSplitPane(singlePane)).toBe(singlePane);
  });

  it("identifies default single-pane state", () => {
    const singleDefault: SplitSessionState = {
      orientation: "vertical",
      paneIds: ["pane-1"],
      focusedPaneId: "pane-1",
      primaryPaneId: "pane-1",
    };
    expect(isDefaultSinglePaneState(singleDefault)).toBe(true);
    expect(isDefaultSinglePaneState({ ...singleDefault, paneIds: ["pane-2"] })).toBe(false);
  });
});
