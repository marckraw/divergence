import { describe, expect, it } from "vitest";
import type { WorkspaceSession } from "../../workspace-session";
import { buildSplitLayout, buildSinglePaneLayout, getFocusedPane } from "./stageLayout.pure";
import {
  addTab,
  addTabWithRef,
  buildSingleTabGroup,
  closeOtherTabs,
  findTabBySessionId,
  focusNextTab,
  focusPreviousTab,
  focusTab,
  getStageTabDisplayLabel,
  getActiveTab,
  removeTab,
  removeTabIfEmpty,
  revealSessionInTabGroup,
  renameTab,
  updateTabLayout,
} from "./stageTab.pure";

describe("stageTab", () => {
  it("builds a single-tab group", () => {
    expect(buildSingleTabGroup({ kind: "terminal", sessionId: "terminal-1" })).toEqual({
      tabs: [
        {
          id: "stage-tab-1",
          label: "Tab 1",
          layout: buildSinglePaneLayout({ kind: "terminal", sessionId: "terminal-1" }),
        },
      ],
      activeTabId: "stage-tab-1",
    });
  });

  it("adds tabs with pending panes or explicit refs and respects the max limit", () => {
    const base = buildSingleTabGroup({ kind: "terminal", sessionId: "terminal-1" });
    const withPending = addTab(base);
    const withAgent = withPending ? addTabWithRef(withPending, { kind: "agent", sessionId: "agent-1" }) : null;

    expect(withPending?.activeTabId).toBe("stage-tab-2");
    expect(withPending?.tabs[1]).toEqual({
      id: "stage-tab-2",
      label: "Tab 2",
      layout: buildSinglePaneLayout({ kind: "pending" }),
    });
    expect(withAgent?.activeTabId).toBe("stage-tab-3");
    expect(withAgent?.tabs[2]?.layout.panes[0]?.ref).toEqual({ kind: "agent", sessionId: "agent-1" });

    let fullGroup = base;
    for (let index = 0; index < 2; index += 1) {
      fullGroup = addTab(fullGroup, 3) ?? fullGroup;
    }
    expect(fullGroup.tabs).toHaveLength(3);
    expect(addTab(fullGroup, 3)).toBeNull();
  });

  it("removes tabs and focuses an adjacent tab", () => {
    const group = addTab(addTab(buildSingleTabGroup({ kind: "terminal", sessionId: "terminal-1" }))!);
    expect(group?.activeTabId).toBe("stage-tab-3");

    const removedActive = group ? removeTab(group, "stage-tab-3") : null;
    expect(removedActive).toEqual({
      tabs: group?.tabs.slice(0, 2),
      activeTabId: "stage-tab-2",
    });

    const removedMiddle = removedActive ? removeTab(removedActive, "stage-tab-2") : null;
    expect(removedMiddle?.activeTabId).toBe("stage-tab-1");
    expect(removeTab(buildSingleTabGroup({ kind: "pending" }), "stage-tab-1")).toBeNull();
  });

  it("closes other tabs while keeping the requested one active", () => {
    const group = addTab(addTab(buildSingleTabGroup({ kind: "terminal", sessionId: "terminal-1" }))!);
    const nextGroup = group ? closeOtherTabs(group, "stage-tab-2") : null;
    const retainedTab = group?.tabs[1] ?? null;

    expect(nextGroup).toEqual({
      tabs: retainedTab ? [retainedTab] : [],
      activeTabId: "stage-tab-2",
    });
  });

  it("focuses tabs, wraps relative navigation, and returns the active tab", () => {
    const group = addTab(addTab(buildSingleTabGroup({ kind: "terminal", sessionId: "terminal-1" }))!);
    const focused = group ? focusTab(group, "stage-tab-1") : null;

    expect(focused?.activeTabId).toBe("stage-tab-1");
    expect(focused ? focusPreviousTab(focused).activeTabId : null).toBe("stage-tab-3");
    expect(focused ? focusNextTab(focused).activeTabId : null).toBe("stage-tab-2");
    expect(focused ? getActiveTab(focused).id : null).toBe("stage-tab-1");
  });

  it("renames, updates, and removes empty tabs", () => {
    const group = addTabWithRef(
      buildSingleTabGroup({ kind: "terminal", sessionId: "terminal-1" }),
      { kind: "agent", sessionId: "agent-1" },
    );
    const renamed = group ? renameTab(group, "stage-tab-2", "PR Review") : null;
    const nextLayout = renamed
      ? buildSplitLayout(renamed.tabs[1].layout, { kind: "terminal", sessionId: "terminal-2" }, "horizontal")
      : null;
    const updated = renamed && nextLayout ? updateTabLayout(renamed, "stage-tab-2", nextLayout) : null;
    const emptyGroup = updated
      ? {
        ...updated,
        tabs: updated.tabs.map((tab) => (
          tab.id === "stage-tab-2"
            ? { ...tab, layout: { ...tab.layout, panes: [], paneSizes: [], focusedPaneId: "stage-pane-1" as const } }
            : tab
        )),
      }
      : null;

    expect(renamed?.tabs[1]?.label).toBe("PR Review");
    expect(updated?.tabs[1]?.layout.orientation).toBe("horizontal");
    expect(removeTabIfEmpty(emptyGroup!, "stage-tab-2")?.tabs).toHaveLength(1);
    expect(renameTab(updated!, "stage-tab-2", "   ")).toBe(updated);
  });

  it("finds which tab contains a session", () => {
    const group = addTabWithRef(
      buildSingleTabGroup({ kind: "terminal", sessionId: "terminal-1" }),
      { kind: "agent", sessionId: "agent-1" },
    );

    expect(group ? findTabBySessionId(group, "terminal-1")?.id : null).toBe("stage-tab-1");
    expect(group ? findTabBySessionId(group, "agent-1")?.id : null).toBe("stage-tab-2");
    expect(group ? findTabBySessionId(group, "missing") : null).toBeNull();
  });

  it("reveals the tab and pane for an existing session", () => {
    const group = addTabWithRef(
      buildSingleTabGroup({ kind: "terminal", sessionId: "terminal-1" }),
      { kind: "agent", sessionId: "agent-1" },
    );
    const secondTab = group?.tabs[1] ?? null;
    const splitSecondTabLayout = secondTab
      ? buildSplitLayout(secondTab.layout, { kind: "terminal", sessionId: "terminal-2" }, "horizontal")
      : null;
    const withSplitSecondTab = group && splitSecondTabLayout
      ? updateTabLayout(group, "stage-tab-2", splitSecondTabLayout)
      : null;
    const withFirstTabFocused = withSplitSecondTab
      ? focusTab(withSplitSecondTab, "stage-tab-1")
      : null;
    const revealed = withFirstTabFocused
      ? revealSessionInTabGroup(withFirstTabFocused, "terminal-2")
      : null;

    expect(revealed?.activeTabId).toBe("stage-tab-2");
    expect(revealed ? getFocusedPane(getActiveTab(revealed).layout).ref : null).toEqual({
      kind: "terminal",
      sessionId: "terminal-2",
    });
    expect(withFirstTabFocused ? revealSessionInTabGroup(withFirstTabFocused, "missing") : null).toBeNull();
  });

  it("derives display labels from the focused session while preserving custom labels", () => {
    const group = addTabWithRef(
      buildSingleTabGroup({ kind: "terminal", sessionId: "terminal-1" }),
      { kind: "agent", sessionId: "agent-1" },
    );
    const terminalSession: WorkspaceSession = {
      id: "terminal-1",
      type: "project",
      targetId: 1,
      projectId: 1,
      workspaceKey: "project:1",
      sessionRole: "default",
      name: "Payments Shell",
      path: "/payments",
      useTmux: true,
      tmuxSessionName: "payments-shell",
      tmuxHistoryLimit: 50000,
      status: "idle",
    };
    const agentSession: WorkspaceSession = {
      kind: "agent",
      id: "agent-1",
      provider: "codex",
      model: "gpt-5.4",
      effort: "medium",
      targetType: "project",
      targetId: 1,
      projectId: 1,
      workspaceKey: "project:1",
      sessionRole: "default",
      nameMode: "default",
      name: "Review Agent",
      path: "/payments",
      status: "idle",
      runtimeStatus: "idle",
      isOpen: true,
      createdAtMs: 1,
      updatedAtMs: 1,
      currentTurnStartedAtMs: null,
      lastRuntimeEventAtMs: null,
      runtimePhase: null,
      conversationContext: null,
      runtimeEvents: [],
      messages: [],
      activities: [],
      pendingRequest: null,
      errorMessage: null,
    };
    const sessionMap = new Map<string, WorkspaceSession>([
      ["terminal-1", terminalSession],
      ["agent-1", agentSession],
    ]);

    expect(group ? getStageTabDisplayLabel(group.tabs[0], sessionMap) : null).toBe("Payments Shell");
    expect(group ? getStageTabDisplayLabel(group.tabs[1], sessionMap) : null).toBe("Review Agent");

    const customLabeledGroup = group
      ? {
        ...group,
        tabs: group.tabs.map((tab) => (
          tab.id === "stage-tab-2" ? { ...tab, label: "Pinned Review" } : tab
        )),
      }
      : null;
    expect(customLabeledGroup ? getStageTabDisplayLabel(customLabeledGroup.tabs[1], sessionMap) : null).toBe("Pinned Review");

    const multiPaneGroup = group
      ? updateTabLayout(
        group,
        "stage-tab-1",
        buildSplitLayout(group.tabs[0].layout, { kind: "pending" }, "vertical"),
      )
      : null;
    expect(multiPaneGroup ? getStageTabDisplayLabel(multiPaneGroup.tabs[0], sessionMap) : null).toBe("Payments Shell +1");
  });
});
