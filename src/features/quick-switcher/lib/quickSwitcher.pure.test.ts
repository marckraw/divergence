import { describe, expect, it } from "vitest";
import type { Divergence, Project, StageTab, WorkspaceSession } from "../../../entities";
import {
  buildQuickSwitcherSearchResults,
  filterQuickSwitcherSearchResults,
} from "./quickSwitcher.pure";

const projects: Project[] = [
  { id: 1, name: "Alpha", path: "/alpha", createdAt: "2026-01-01" },
  { id: 2, name: "Beta", path: "/beta", createdAt: "2026-01-01" },
];

const divergences = new Map<number, Divergence[]>([
  [
    1,
    [
      {
        id: 10,
        projectId: 1,
        name: "Alpha Div",
        branch: "feat/search",
        path: "/alpha/feat-search",
        createdAt: "2026-01-01",
        hasDiverged: false,
      },
    ],
  ],
]);

const sessions = new Map<string, WorkspaceSession>([
  ["divergence-10", {
    id: "divergence-10",
    type: "divergence",
    targetId: 10,
    projectId: 1,
    workspaceKey: "divergence:10",
    sessionRole: "default",
    name: "Alpha Div",
    path: "/alpha/feat-search",
    useTmux: true,
    tmuxSessionName: "divergence-branch-alpha-feat-search-10",
    tmuxHistoryLimit: 50000,
    status: "idle",
  }],
]);

const stageTabs: StageTab[] = [
  {
    id: "stage-tab-1",
    label: "Tab 1",
    layout: {
      orientation: "vertical",
      panes: [
        {
          id: "stage-pane-1",
          ref: { kind: "terminal", sessionId: "divergence-10" },
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
      orientation: "vertical",
      panes: [
        {
          id: "stage-pane-1",
          ref: { kind: "pending" },
        },
      ],
      paneSizes: [1],
      focusedPaneId: "stage-pane-1",
    },
  },
];

describe("quick switcher utils", () => {
  it("builds combined search list", () => {
    const items = buildQuickSwitcherSearchResults(projects, divergences, sessions);
    expect(items).toHaveLength(4);
    expect(items.find((item) => item.type === "divergence")?.projectName).toBe("Alpha");
    expect(items.find((item) => item.type === "session")).toBeTruthy();
  });

  it("filters by query", () => {
    const items = buildQuickSwitcherSearchResults(projects, divergences, sessions);
    expect(filterQuickSwitcherSearchResults(items, "beta")).toHaveLength(1);
    expect(filterQuickSwitcherSearchResults(items, "feat/search")).toHaveLength(2);
    expect(filterQuickSwitcherSearchResults(items, "alpha")).toHaveLength(3);
    expect(filterQuickSwitcherSearchResults(items, "  ")).toHaveLength(4);
  });

  it("includes stage tabs and matches them by label in reveal mode", () => {
    const items = buildQuickSwitcherSearchResults(projects, divergences, sessions, undefined, undefined, stageTabs);
    expect(items.find((item) => item.type === "stage_tab" && (item.item as StageTab).label === "PR Review")).toBeTruthy();
    expect(filterQuickSwitcherSearchResults(items, "tab 1")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "stage_tab",
          item: expect.objectContaining({ label: "Tab 1" }),
        }),
      ]),
    );
    expect(filterQuickSwitcherSearchResults(items, "pr review")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "stage_tab",
          item: expect.objectContaining({ label: "PR Review" }),
        }),
      ]),
    );
  });
});
