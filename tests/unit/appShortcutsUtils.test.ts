import { describe, expect, it } from "vitest";
import { resolveAppShortcut, type AppShortcutContext, type AppShortcutEvent } from "../../src/lib/utils/appShortcuts";

const baseEvent: AppShortcutEvent = {
  defaultPrevented: false,
  key: "",
  metaKey: true,
  ctrlKey: false,
  shiftKey: false,
};

const baseContext: AppShortcutContext = {
  isFromEditor: false,
  hasActiveSession: true,
  activeSessionId: "project-1",
  sessionCount: 3,
  hasCreateDivergenceModalOpen: false,
  canResolveProjectForNewDivergence: true,
};

describe("app shortcuts utils", () => {
  it("ignores prevented/editor events", () => {
    expect(resolveAppShortcut({ ...baseEvent, defaultPrevented: true }, baseContext)).toBeNull();
    expect(resolveAppShortcut(baseEvent, { ...baseContext, isFromEditor: true })).toBeNull();
  });

  it("resolves core shortcuts", () => {
    expect(resolveAppShortcut({ ...baseEvent, key: "k" }, baseContext)?.type).toBe("toggle_quick_switcher");
    expect(resolveAppShortcut({ ...baseEvent, key: "," }, baseContext)?.type).toBe("toggle_settings");
    expect(resolveAppShortcut({ ...baseEvent, key: "b", shiftKey: true }, baseContext)?.type).toBe("toggle_right_panel");
    expect(resolveAppShortcut({ ...baseEvent, key: "b" }, baseContext)?.type).toBe("toggle_sidebar");
  });

  it("resolves session actions and tab navigation", () => {
    expect(resolveAppShortcut({ ...baseEvent, key: "w" }, baseContext)?.type).toBe("close_active_session");
    expect(resolveAppShortcut({ ...baseEvent, key: "d", shiftKey: true }, baseContext)).toEqual({
      type: "split_terminal",
      orientation: "horizontal",
    });
    expect(resolveAppShortcut({ ...baseEvent, key: "2" }, baseContext)).toEqual({
      type: "select_tab",
      index: 1,
    });
    expect(resolveAppShortcut({ ...baseEvent, key: "[" }, baseContext)?.type).toBe("select_previous_tab");
    expect(resolveAppShortcut({ ...baseEvent, key: "]" }, baseContext)?.type).toBe("select_next_tab");
  });

  it("enforces preconditions", () => {
    expect(resolveAppShortcut({ ...baseEvent, key: "o", shiftKey: true }, {
      ...baseContext,
      hasActiveSession: false,
    })).toBeNull();

    expect(resolveAppShortcut({ ...baseEvent, key: "t" }, {
      ...baseContext,
      hasCreateDivergenceModalOpen: true,
    })).toBeNull();

    expect(resolveAppShortcut({ ...baseEvent, key: "Escape", metaKey: false, ctrlKey: false }, baseContext)).toEqual({
      type: "close_overlays",
    });
  });
});
