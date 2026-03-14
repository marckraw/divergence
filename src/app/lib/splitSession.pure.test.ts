import { describe, expect, it } from "vitest";
import {
  MAX_SPLIT_PANES,
  type SplitSessionState,
} from "../../entities/terminal-session";
import {
  buildNextSplitState,
  closeFocusedSplitPane,
  focusNextSplitPane,
  focusPreviousSplitPane,
  focusSplitPane,
  isDefaultSinglePaneState,
} from "./splitSession.pure";

describe("split session utils", () => {
  it("creates split state and caps at max panes", () => {
    const first = buildNextSplitState(null, "vertical");
    expect(first.paneIds).toEqual(["pane-1", "pane-2"]);
    expect(first.paneSizes).toEqual([0.5, 0.5]);
    expect(first.focusedPaneId).toBe("pane-2");
    expect(first.primaryPaneId).toBe("pane-1");

    const second = buildNextSplitState(first, "vertical");
    expect(second.paneIds).toEqual(["pane-1", "pane-2", "pane-3"]);
    expect(second.paneSizes).toHaveLength(3);
    expect(second.paneSizes?.[0]).toBeCloseTo(1 / 3, 5);
    expect(second.paneSizes?.[1]).toBeCloseTo(1 / 3, 5);
    expect(second.paneSizes?.[2]).toBeCloseTo(1 / 3, 5);

    const third = buildNextSplitState(second, "vertical");
    expect(third.paneIds).toEqual(["pane-1", "pane-2", "pane-3", "pane-4"]);
    expect(third.paneSizes).toHaveLength(4);
    expect(third.paneSizes?.[0]).toBeCloseTo(0.25, 5);
    expect(third.paneSizes?.[1]).toBeCloseTo(0.25, 5);
    expect(third.paneSizes?.[2]).toBeCloseTo(0.25, 5);
    expect(third.paneSizes?.[3]).toBeCloseTo(0.25, 5);

    const fourth = buildNextSplitState(third, "horizontal");
    expect(fourth.paneIds).toEqual(["pane-1", "pane-2", "pane-3", "pane-4", "pane-5"]);
    expect(fourth.orientation).toBe("horizontal");
    expect(fourth.paneSizes).toHaveLength(5);
    expect(fourth.paneSizes?.every((size) => size === 0.2)).toBe(true);

    const fifth = buildNextSplitState(fourth, "vertical");
    expect(fifth.paneIds).toEqual(["pane-1", "pane-2", "pane-3", "pane-4", "pane-5", "pane-6"]);
    expect(fifth.paneIds).toHaveLength(MAX_SPLIT_PANES);
    expect(fifth.paneSizes).toHaveLength(MAX_SPLIT_PANES);
    expect(fifth.paneSizes?.every((size) => Math.abs(size - (1 / 6)) < 1e-6)).toBe(true);

    const sixth = buildNextSplitState(fifth, "horizontal");
    expect(sixth.paneIds).toEqual(fifth.paneIds);
    expect(sixth.orientation).toBe("horizontal");
    expect(sixth.paneSizes).toHaveLength(MAX_SPLIT_PANES);
    sixth.paneSizes?.forEach((size, index) => {
      expect(size).toBeCloseTo(fifth.paneSizes?.[index] ?? 0, 10);
    });
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
    expect(afterClose?.paneSizes).toEqual([0.5, 0.5]);
    expect(afterClose?.focusedPaneId).toBe("pane-1");
  });

  it("cycles focus to next and previous pane", () => {
    const state = buildNextSplitState(
      buildNextSplitState(
        buildNextSplitState(null, "vertical"),
        "vertical",
      ),
      "horizontal",
    );
    const expanded = buildNextSplitState(state, "vertical");
    const maxed = buildNextSplitState(expanded, "horizontal");
    expect(maxed.paneIds).toEqual(["pane-1", "pane-2", "pane-3", "pane-4", "pane-5", "pane-6"]);
    expect(maxed.focusedPaneId).toBe("pane-6");

    const next1 = focusNextSplitPane(maxed);
    expect(next1.focusedPaneId).toBe("pane-1");

    const next2 = focusNextSplitPane(next1);
    expect(next2.focusedPaneId).toBe("pane-2");

    const prev1 = focusPreviousSplitPane(next2);
    expect(prev1.focusedPaneId).toBe("pane-1");

    const prev2 = focusPreviousSplitPane(prev1);
    expect(prev2.focusedPaneId).toBe("pane-6");
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
