import { describe, expect, it } from "vitest";
import type { StageLayout } from "../../entities";
import { resolveQuickSwitcherMode } from "./quickSwitcherMode.pure";

describe("resolveQuickSwitcherMode", () => {
  it("opens the pane-local command center for a focused pending pane", () => {
    const stageLayout: StageLayout = {
      orientation: "vertical",
      focusedPaneId: "stage-pane-2",
      paneSizes: [0.5, 0.5],
      panes: [
        {
          id: "stage-pane-1",
          ref: { kind: "terminal", sessionId: "terminal-1" },
        },
        {
          id: "stage-pane-2",
          ref: { kind: "pending", sourceSessionId: "terminal-1" },
        },
      ],
    };

    expect(resolveQuickSwitcherMode({
      previousMode: null,
      stageLayout,
      focusedPaneId: "stage-pane-2",
    })).toEqual({
      kind: "open-in-pane",
      targetPaneId: "stage-pane-2",
      sourceSessionId: "terminal-1",
    });
  });

  it("toggles off the pane-local command center when it is already open for the focused pane", () => {
    const stageLayout: StageLayout = {
      orientation: "vertical",
      focusedPaneId: "stage-pane-2",
      paneSizes: [0.5, 0.5],
      panes: [
        {
          id: "stage-pane-1",
          ref: { kind: "terminal", sessionId: "terminal-1" },
        },
        {
          id: "stage-pane-2",
          ref: { kind: "pending", sourceSessionId: "terminal-1" },
        },
      ],
    };

    expect(resolveQuickSwitcherMode({
      previousMode: {
        kind: "open-in-pane",
        targetPaneId: "stage-pane-2",
        sourceSessionId: "terminal-1",
      },
      stageLayout,
      focusedPaneId: "stage-pane-2",
    })).toBeNull();
  });

  it("falls back to reveal mode when the focused pane is not pending", () => {
    const stageLayout: StageLayout = {
      orientation: "vertical",
      focusedPaneId: "stage-pane-1",
      paneSizes: [1],
      panes: [
        {
          id: "stage-pane-1",
          ref: { kind: "terminal", sessionId: "terminal-1" },
        },
      ],
    };

    expect(resolveQuickSwitcherMode({
      previousMode: null,
      stageLayout,
      focusedPaneId: "stage-pane-1",
    })).toEqual({ kind: "reveal" });
  });
});
