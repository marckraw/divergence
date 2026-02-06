import { describe, expect, it } from "vitest";
import type { Project, TerminalSession } from "../../src/types";
import { resolveProjectForNewDivergence } from "../../src/app/lib/appSelection.pure";

const projectA: Project = { id: 1, name: "A", path: "/a", created_at: "2026-01-01" };
const projectB: Project = { id: 2, name: "B", path: "/b", created_at: "2026-01-01" };

function makeSession(projectId: number): TerminalSession {
  return {
    id: `project-${projectId}`,
    type: "project",
    targetId: projectId,
    projectId,
    name: `P${projectId}`,
    path: `/p${projectId}`,
    useTmux: true,
    tmuxSessionName: "x",
    tmuxHistoryLimit: 1000,
    useWebgl: true,
    status: "idle",
  };
}

describe("app selection utils", () => {
  it("returns active session project when available", () => {
    const sessions = new Map([["project-2", makeSession(2)]]);
    expect(resolveProjectForNewDivergence({
      activeSessionId: "project-2",
      sessions,
      projects: [projectA, projectB],
    })?.id).toBe(2);
  });

  it("falls back to single project or null", () => {
    expect(resolveProjectForNewDivergence({
      activeSessionId: "missing",
      sessions: new Map(),
      projects: [projectA],
    })?.id).toBe(1);

    expect(resolveProjectForNewDivergence({
      activeSessionId: null,
      sessions: new Map(),
      projects: [projectA, projectB],
    })).toBeNull();
  });
});
