import { describe, expect, it } from "vitest";
import type { Divergence, Project } from "../../src/types";
import {
  buildQuickSwitcherSearchResults,
  filterQuickSwitcherSearchResults,
} from "../../src/lib/utils/quickSwitcher";

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

describe("quick switcher utils", () => {
  it("builds combined search list", () => {
    const items = buildQuickSwitcherSearchResults(projects, divergences);
    expect(items).toHaveLength(3);
    expect(items.find((item) => item.type === "divergence")?.projectName).toBe("Alpha");
  });

  it("filters by query", () => {
    const items = buildQuickSwitcherSearchResults(projects, divergences);
    expect(filterQuickSwitcherSearchResults(items, "beta")).toHaveLength(1);
    expect(filterQuickSwitcherSearchResults(items, "feat/search")).toHaveLength(1);
    expect(filterQuickSwitcherSearchResults(items, "alpha")).toHaveLength(2);
    expect(filterQuickSwitcherSearchResults(items, "  ")).toHaveLength(3);
  });
});
