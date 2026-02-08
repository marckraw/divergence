import { describe, expect, it } from "vitest";
import type { Divergence, Project, TerminalSession } from "../../src/types";
import {
  buildQuickSwitcherSearchResults,
  filterQuickSwitcherSearchResults,
} from "../../src/features/quick-switcher/lib/quickSwitcher.pure";

const projects: Project[] = [
  { id: 1, name: "Alpha", path: "/alpha", created_at: "2026-01-01" },
  { id: 2, name: "Beta", path: "/beta", created_at: "2026-01-01" },
];

const divergences = new Map<number, Divergence[]>([
  [
    1,
    [
      {
        id: 10,
        project_id: 1,
        name: "Alpha Div",
        branch: "feat/search",
        path: "/alpha/feat-search",
        created_at: "2026-01-01",
        has_diverged: 0,
      },
    ],
  ],
]);

const sessions = new Map<string, TerminalSession>([
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
    useWebgl: true,
    status: "idle",
  }],
]);

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
});
