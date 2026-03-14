import { describe, expect, it } from "vitest";
import type { Divergence, Project, TmuxSessionWithOwnership } from "../../../types";
import {
  findSessionIdsByTmuxSessionName,
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
    socket_path: "/tmp/tmux-501/default",
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

  it("maps tmux panel session names back to app session ids", () => {
    const sessions = [
      {
        id: "project-1",
        tmuxSessionName: "divergence-project-alpha-1",
      },
      {
        id: "divergence-2",
        tmuxSessionName: "divergence-branch-alpha-feat-search-2",
      },
    ] as const;

    expect(
      findSessionIdsByTmuxSessionName(
        sessions,
        "divergence-project-alpha-1"
      )
    ).toEqual(["project-1"]);

    expect(
      findSessionIdsByTmuxSessionName(
        sessions,
        "divergence-project-alpha-1-pane-2"
      )
    ).toEqual(["project-1"]);

    expect(
      findSessionIdsByTmuxSessionName(
        sessions,
        "divergence-branch-alpha-feat-search-2-pane-3"
      )
    ).toEqual(["divergence-2"]);

    expect(
      findSessionIdsByTmuxSessionName(
        sessions,
        "divergence-project-alpha-1-pane-6"
      )
    ).toEqual(["project-1"]);

    expect(
      findSessionIdsByTmuxSessionName(
        sessions,
        "divergence-non-existent"
      )
    ).toEqual([]);
  });
});
