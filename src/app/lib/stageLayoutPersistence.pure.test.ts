import { describe, expect, it } from "vitest";
import {
  buildPersistedStageLayoutSnapshot,
  normalizePersistedStageLayoutState,
} from "./stageLayoutPersistence.pure";

describe("stageLayoutPersistence", () => {
  it("builds a v3 snapshot and keeps pending panes", () => {
    expect(buildPersistedStageLayoutSnapshot({
      tabs: [
        {
          id: "stage-tab-1",
          label: "Tab 1",
          layout: {
            orientation: "horizontal",
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
            paneSizes: [3, 1],
            focusedPaneId: "stage-pane-2",
          },
        },
      ],
      activeTabId: "stage-tab-1",
    })).toEqual({
      version: 3,
      tabs: [
        {
          id: "stage-tab-1",
          label: "Tab 1",
          layout: {
            orientation: "horizontal",
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
            paneSizes: [0.75, 0.25],
            focusedPaneId: "stage-pane-2",
          },
        },
      ],
      activeTabId: "stage-tab-1",
    });
  });

  it("normalizes v2/v3 snapshots and rejects invalid payloads", () => {
    expect(normalizePersistedStageLayoutState({
      version: 3,
      tabs: [
        {
          id: "stage-tab-2",
          label: "PR Review",
          layout: {
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
              {
                id: "stage-pane-3",
                ref: { kind: "editor", sessionId: "editor-1" },
              },
            ],
            paneSizes: [3, 1, 2],
            focusedPaneId: "stage-pane-3",
          },
        },
      ],
      activeTabId: "stage-tab-2",
    })).toEqual({
      tabs: [
        {
          id: "stage-tab-2",
          label: "PR Review",
          layout: {
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
              {
                id: "stage-pane-3",
                ref: { kind: "editor", sessionId: "editor-1" },
              },
            ],
            paneSizes: [0.5, 1 / 6, 1 / 3],
            focusedPaneId: "stage-pane-3",
          },
        },
      ],
      activeTabId: "stage-tab-2",
    });

    expect(normalizePersistedStageLayoutState({
      version: 3,
      tabs: [
        {
          id: "stage-tab-1",
          layout: {
            panes: [
              {
                id: "stage-pane-1",
                ref: { kind: "pending", sourceSessionId: "terminal-1" },
              },
            ],
          },
        },
      ],
    })).toEqual({
      tabs: [
        {
          id: "stage-tab-1",
          label: "Tab 1",
          layout: {
            orientation: "vertical",
            panes: [
              {
                id: "stage-pane-1",
                ref: { kind: "pending", sourceSessionId: "terminal-1" },
              },
            ],
            paneSizes: [1],
            focusedPaneId: "stage-pane-1",
          },
        },
      ],
      activeTabId: "stage-tab-1",
    });

    expect(normalizePersistedStageLayoutState({
      version: 3,
      tabs: [],
    })).toBeNull();
  });

  it("migrates legacy single-layout snapshots into a single-tab group", () => {
    expect(normalizePersistedStageLayoutState({
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
    })).toEqual({
      tabs: [
        {
          id: "stage-tab-1",
          label: "Tab 1",
          layout: {
            orientation: "horizontal",
            panes: [
              {
                id: "stage-pane-1",
                ref: { kind: "terminal", sessionId: "terminal-1" },
              },
            ],
            paneSizes: [1],
            focusedPaneId: "stage-pane-1",
          },
        },
      ],
      activeTabId: "stage-tab-1",
    });
  });

  it("preserves multiple tabs, labels, and active tab across persistence", () => {
    const snapshot = buildPersistedStageLayoutSnapshot({
      tabs: [
        {
          id: "stage-tab-1",
          label: "Tab 1",
          layout: {
            orientation: "vertical",
            panes: [
              {
                id: "stage-pane-1",
                ref: { kind: "terminal", sessionId: "terminal-1" },
              },
            ],
            paneSizes: [1],
            focusedPaneId: "stage-pane-1",
          },
        },
        {
          id: "stage-tab-2",
          label: "PR Review",
          layout: {
            orientation: "horizontal",
            panes: [
              {
                id: "stage-pane-1",
                ref: { kind: "agent", sessionId: "agent-1" },
              },
              {
                id: "stage-pane-2",
                ref: { kind: "pending", sourceSessionId: "agent-1" },
              },
            ],
            paneSizes: [2, 1],
            focusedPaneId: "stage-pane-1",
          },
        },
      ],
      activeTabId: "stage-tab-2",
    });

    expect(snapshot).toEqual({
      version: 3,
      tabs: [
        {
          id: "stage-tab-1",
          label: "Tab 1",
          layout: {
            orientation: "vertical",
            panes: [
              {
                id: "stage-pane-1",
                ref: { kind: "terminal", sessionId: "terminal-1" },
              },
            ],
            paneSizes: [1],
            focusedPaneId: "stage-pane-1",
          },
        },
        {
          id: "stage-tab-2",
          label: "PR Review",
          layout: {
            orientation: "horizontal",
            panes: [
              {
                id: "stage-pane-1",
                ref: { kind: "agent", sessionId: "agent-1" },
              },
              {
                id: "stage-pane-2",
                ref: { kind: "pending", sourceSessionId: "agent-1" },
              },
            ],
            paneSizes: [2 / 3, 1 / 3],
            focusedPaneId: "stage-pane-1",
          },
        },
      ],
      activeTabId: "stage-tab-2",
    });

    expect(normalizePersistedStageLayoutState(snapshot)).toEqual({
      tabs: [
        {
          id: "stage-tab-1",
          label: "Tab 1",
          layout: {
            orientation: "vertical",
            panes: [
              {
                id: "stage-pane-1",
                ref: { kind: "terminal", sessionId: "terminal-1" },
              },
            ],
            paneSizes: [1],
            focusedPaneId: "stage-pane-1",
          },
        },
        {
          id: "stage-tab-2",
          label: "PR Review",
          layout: {
            orientation: "horizontal",
            panes: [
              {
                id: "stage-pane-1",
                ref: { kind: "agent", sessionId: "agent-1" },
              },
              {
                id: "stage-pane-2",
                ref: { kind: "pending", sourceSessionId: "agent-1" },
              },
            ],
            paneSizes: [2 / 3, 1 / 3],
            focusedPaneId: "stage-pane-1",
          },
        },
      ],
      activeTabId: "stage-tab-2",
    });
  });

  it("migrates v2 snapshots with editor pane refs", () => {
    expect(normalizePersistedStageLayoutState({
      version: 2,
      tabs: [
        {
          id: "stage-tab-1",
          label: "Tab 1",
          layout: {
            orientation: "vertical",
            panes: [
              {
                id: "stage-pane-1",
                ref: { kind: "editor", sessionId: "editor-1" },
              },
            ],
            paneSizes: [1],
            focusedPaneId: "stage-pane-1",
          },
        },
      ],
      activeTabId: "stage-tab-1",
    })).toEqual({
      tabs: [
        {
          id: "stage-tab-1",
          label: "Tab 1",
          layout: {
            orientation: "vertical",
            panes: [
              {
                id: "stage-pane-1",
                ref: { kind: "editor", sessionId: "editor-1" },
              },
            ],
            paneSizes: [1],
            focusedPaneId: "stage-pane-1",
          },
        },
      ],
      activeTabId: "stage-tab-1",
    });
  });
});
