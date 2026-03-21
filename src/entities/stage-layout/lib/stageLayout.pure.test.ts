import { describe, expect, it } from "vitest";
import {
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
} from "./stageLayout.pure";

describe("stageLayout", () => {
  it("builds a single-pane layout", () => {
    expect(buildSinglePaneLayout({ kind: "terminal", sessionId: "terminal-1" })).toEqual({
      orientation: "vertical",
      panes: [
        {
          id: "stage-pane-1",
          ref: { kind: "terminal", sessionId: "terminal-1" },
        },
      ],
      paneSizes: [1],
      focusedPaneId: "stage-pane-1",
    });
  });

  it("splits the layout, resets sizes evenly, and focuses the new pane", () => {
    const initial = buildSinglePaneLayout({ kind: "terminal", sessionId: "terminal-1" });

    expect(buildSplitLayout(initial, { kind: "agent", sessionId: "agent-1" }, "horizontal")).toEqual({
      orientation: "horizontal",
      panes: [
        {
          id: "stage-pane-1",
          ref: { kind: "terminal", sessionId: "terminal-1" },
        },
        {
          id: "stage-pane-2",
          ref: { kind: "agent", sessionId: "agent-1" },
        },
      ],
      paneSizes: [0.5, 0.5],
      focusedPaneId: "stage-pane-2",
    });
  });

  it("does not exceed the maximum pane count", () => {
    const layout = buildSplitLayout(
      buildSplitLayout(
        buildSplitLayout(
          buildSinglePaneLayout({ kind: "terminal", sessionId: "terminal-1" }),
          { kind: "agent", sessionId: "agent-1" },
          "vertical",
        ),
        { kind: "terminal", sessionId: "terminal-2" },
        "vertical",
      ),
      { kind: "pending" },
      "vertical",
    );

    expect(layout.panes).toHaveLength(4);
    expect(buildSplitLayout(layout, { kind: "agent", sessionId: "agent-2" }, "horizontal")).toEqual({
      ...layout,
      orientation: "horizontal",
    });
  });

  it("removes panes and rebalances sizes", () => {
    const split = buildSplitLayout(
      buildSplitLayout(
        buildSinglePaneLayout({ kind: "terminal", sessionId: "terminal-1" }),
        { kind: "agent", sessionId: "agent-1" },
        "vertical",
      ),
      { kind: "terminal", sessionId: "terminal-2" },
      "vertical",
    );
    const focused = focusPane(split, "stage-pane-2");
    const next = removePaneFromLayout(focused, "stage-pane-2");

    expect(next).toEqual({
      orientation: "vertical",
      panes: [
        {
          id: "stage-pane-1",
          ref: { kind: "terminal", sessionId: "terminal-1" },
        },
        {
          id: "stage-pane-3",
          ref: { kind: "terminal", sessionId: "terminal-2" },
        },
      ],
      paneSizes: [0.5, 0.5],
      focusedPaneId: "stage-pane-3",
    });
    expect(removePaneFromLayout(buildSinglePaneLayout({ kind: "pending" }), "stage-pane-1")).toBeNull();
  });

  it("resizes and replaces pane refs", () => {
    const split = buildSplitLayout(
      buildSinglePaneLayout({ kind: "terminal", sessionId: "terminal-1" }),
      { kind: "pending" },
      "vertical",
    );
    const resized = resizePanes(split, [3, 1]);
    const dragged = resizeAdjacentPanes(resized, 0, -0.2);
    const replaced = replacePaneRef(dragged, "stage-pane-2", { kind: "agent", sessionId: "agent-1" });

    expect(resized.paneSizes).toEqual([0.75, 0.25]);
    expect(dragged.paneSizes[0]).toBeCloseTo(0.55, 5);
    expect(dragged.paneSizes[1]).toBeCloseTo(0.45, 5);
    expect(replaced.panes[1]?.ref).toEqual({ kind: "agent", sessionId: "agent-1" });
    expect(replaced.focusedPaneId).toBe("stage-pane-2");
  });

  it("finds the focused pane, session-bound pane, and single-pane state", () => {
    const split = buildSplitLayout(
      buildSinglePaneLayout({ kind: "terminal", sessionId: "terminal-1" }),
      { kind: "agent", sessionId: "agent-1" },
      "horizontal",
    );

    expect(getFocusedPane(split).id).toBe("stage-pane-2");
    expect(getPaneBySessionId(split, "agent-1")?.id).toBe("stage-pane-2");
    expect(getPaneBySessionId(split, "missing")).toBeNull();
    expect(isSinglePane(buildSinglePaneLayout({ kind: "pending" }))).toBe(true);
    expect(isSinglePane(split)).toBe(false);
  });
});
