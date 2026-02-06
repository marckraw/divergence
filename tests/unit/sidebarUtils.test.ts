import { describe, expect, it } from "vitest";
import type { Divergence, Project, TerminalSession } from "../../src/types";
import {
  areAllExpanded,
  buildSessionId,
  getExpandableProjectIds,
  getProjectNameFromSelectedPath,
  getSessionStatus,
  isSessionActive,
  toggleAllExpandedProjects,
  toggleExpandedProjectId,
} from "../../src/lib/utils/sidebar";

const projects: Project[] = [
  { id: 1, name: "A", path: "/a", created_at: "2026-01-01" },
  { id: 2, name: "B", path: "/b", created_at: "2026-01-01" },
];

const divergences = new Map<number, Divergence[]>([
  [1, [{
    id: 10,
    project_id: 1,
    name: "A div",
    branch: "feat/x",
    path: "/a/x",
    created_at: "2026-01-01",
    has_diverged: 0,
  }]],
]);

describe("sidebar utils", () => {
  it("builds session ids and project names", () => {
    expect(buildSessionId("project", 2)).toBe("project-2");
    expect(getProjectNameFromSelectedPath("/tmp/my-project")).toBe("my-project");
  });

  it("handles expandable project sets", () => {
    const ids = getExpandableProjectIds(projects, divergences);
    expect(ids).toEqual([1]);
    expect(areAllExpanded(new Set([1]), ids)).toBe(true);

    const once = toggleExpandedProjectId(new Set<number>(), 1);
    expect(Array.from(once)).toEqual([1]);

    const all = toggleAllExpandedProjects(new Set<number>(), ids);
    expect(Array.from(all)).toEqual([1]);
    const none = toggleAllExpandedProjects(all, ids);
    expect(Array.from(none)).toEqual([]);
  });

  it("reads active and status from session map", () => {
    const sessions = new Map<string, TerminalSession>([
      ["project-1", {
        id: "project-1",
        type: "project",
        targetId: 1,
        projectId: 1,
        name: "A",
        path: "/a",
        useTmux: true,
        tmuxSessionName: "x",
        tmuxHistoryLimit: 1000,
        useWebgl: true,
        status: "busy",
      }],
    ]);

    expect(getSessionStatus(sessions, "project", 1)).toBe("busy");
    expect(getSessionStatus(sessions, "divergence", 10)).toBeNull();
    expect(isSessionActive("project-1", "project", 1)).toBe(true);
  });
});
