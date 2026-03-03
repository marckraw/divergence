import { describe, expect, it } from "vitest";
import { resolveActivePaneSessionId } from "./activePaneSession.pure";

describe("resolveActivePaneSessionId", () => {
  it("returns null without an active session id", () => {
    expect(resolveActivePaneSessionId(null, null)).toBeNull();
  });

  it("returns the base session id without split state", () => {
    expect(resolveActivePaneSessionId("session-1", null)).toBe("session-1");
  });

  it("returns the base session id for pane-1 focus", () => {
    expect(resolveActivePaneSessionId("session-1", {
      orientation: "vertical",
      paneIds: ["pane-1", "pane-2"],
      paneSizes: [0.5, 0.5],
      focusedPaneId: "pane-1",
      primaryPaneId: "pane-1",
    })).toBe("session-1");
  });

  it("returns the focused pane session id for split panes", () => {
    expect(resolveActivePaneSessionId("session-1", {
      orientation: "vertical",
      paneIds: ["pane-1", "pane-2"],
      paneSizes: [0.5, 0.5],
      focusedPaneId: "pane-2",
      primaryPaneId: "pane-1",
    })).toBe("session-1-pane-2");
  });

  it("falls back to base session id when focused pane is invalid", () => {
    expect(resolveActivePaneSessionId("session-1", {
      orientation: "vertical",
      paneIds: ["pane-1", "pane-2"],
      paneSizes: [0.5, 0.5],
      focusedPaneId: "pane-3",
      primaryPaneId: "pane-1",
    })).toBe("session-1");
  });
});
