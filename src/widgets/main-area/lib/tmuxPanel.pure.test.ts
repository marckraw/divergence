import { describe, expect, it } from "vitest";
import type { Divergence, Project, TmuxSessionWithOwnership } from "../../../types";
import {
  filterTmuxSessions,
  getTmuxOwnershipBadge,
  getTmuxSessionSearchText,
} from "./tmuxPanel.pure";

const project: Project = {
  id: 1,
  name: "Alpha",
  path: "/alpha",
  createdAt: "2026-01-01",
};

const divergence: Divergence = {
  id: 2,
  projectId: 1,
  name: "Alpha Div",
  branch: "feat/search",
  path: "/alpha/div",
  createdAt: "2026-01-01",
  hasDiverged: false,
};

function makeSession(ownership: TmuxSessionWithOwnership["ownership"]): TmuxSessionWithOwnership {
  return {
    name: "sess",
    created: "now",
    attached: true,
    window_count: 1,
    activity: "now",
    ownership,
  };
}

describe("tmux panel utils", () => {
  it("builds ownership badges", () => {
    expect(getTmuxOwnershipBadge(makeSession({ kind: "project", project })).text).toBe("Alpha");
    expect(
      getTmuxOwnershipBadge(makeSession({ kind: "divergence", project, divergence })).text
    ).toBe("Alpha / feat/search");
    expect(getTmuxOwnershipBadge(makeSession({ kind: "orphan" })).text).toBe("orphan");
    expect(getTmuxOwnershipBadge(makeSession({ kind: "unknown" })).text).toBe("checking");
  });

  it("builds search text and filters sessions", () => {
    const sessions: TmuxSessionWithOwnership[] = [
      {
        ...makeSession({ kind: "project", project }),
        name: "alpha-main",
        attached: false,
      },
      {
        ...makeSession({ kind: "divergence", project, divergence }),
        name: "alpha-branch",
      },
    ];

    expect(getTmuxSessionSearchText(sessions[0])).toContain("detached");
    expect(filterTmuxSessions(sessions, "feat/search").map((session) => session.name)).toEqual([
      "alpha-branch",
    ]);
    expect(filterTmuxSessions(sessions, "   ")).toHaveLength(2);
  });
});
