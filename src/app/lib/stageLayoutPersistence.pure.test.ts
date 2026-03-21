import { describe, expect, it } from "vitest";
import {
  buildPersistedStageLayoutSnapshot,
  normalizePersistedStageLayoutState,
} from "./stageLayoutPersistence.pure";

describe("stageLayoutPersistence", () => {
  it("builds a snapshot without pending panes", () => {
    expect(buildPersistedStageLayoutSnapshot({
      orientation: "horizontal",
      panes: [
        {
          id: "stage-pane-1",
          ref: { kind: "terminal", sessionId: "terminal-1" },
        },
        {
          id: "stage-pane-2",
          ref: { kind: "pending" },
        },
      ],
      paneSizes: [0.5, 0.5],
      focusedPaneId: "stage-pane-2",
    })).toEqual({
      version: 1,
      orientation: "horizontal",
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

  it("normalizes persisted layouts and rejects invalid payloads", () => {
    expect(normalizePersistedStageLayoutState({
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
      paneSizes: [3, 1],
      focusedPaneId: "stage-pane-2",
    })).toEqual({
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
      paneSizes: [0.75, 0.25],
      focusedPaneId: "stage-pane-2",
    });

    expect(normalizePersistedStageLayoutState({
      panes: [
        {
          id: "stage-pane-1",
          ref: { kind: "pending" },
        },
      ],
    })).toBeNull();
  });
});
