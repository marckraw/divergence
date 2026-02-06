import { describe, expect, it } from "vitest";
import type { Divergence, Project, TmuxSessionEntry } from "../../src/types";
import {
  annotateTmuxSessions,
  buildTmuxOwnershipMap,
  countOrphanTmuxSessions,
} from "../../src/lib/utils/tmuxOwnership";
import { buildTmuxSessionName } from "../../src/lib/tmux";

const project: Project = {
  id: 1,
  name: "Alpha",
  path: "/alpha",
  created_at: "2026-01-01",
};

const divergence: Divergence = {
  id: 9,
  project_id: 1,
  name: "Alpha div",
  branch: "feat/search",
  path: "/alpha/div",
  created_at: "2026-01-01",
  has_diverged: 0,
};

describe("tmux ownership utils", () => {
  it("builds ownership map and annotates sessions", () => {
    const map = buildTmuxOwnershipMap([project], new Map([[1, [divergence]]]));

    const projectSessionName = buildTmuxSessionName({
      type: "project",
      projectName: project.name,
      projectId: project.id,
    });

    const sessions: TmuxSessionEntry[] = [
      {
        name: projectSessionName,
        created: "now",
        attached: true,
        window_count: 1,
        activity: "now",
      },
      {
        name: "divergence-random",
        created: "now",
        attached: false,
        window_count: 1,
        activity: "now",
      },
    ];

    const annotated = annotateTmuxSessions(sessions, map, true);
    expect(annotated[0].ownership.kind).toBe("project");
    expect(annotated[1].ownership.kind).toBe("orphan");
    expect(countOrphanTmuxSessions(annotated, true)).toBe(1);
  });

  it("marks unknown when ownership is not ready", () => {
    const annotated = annotateTmuxSessions([], new Map(), false);
    expect(annotated).toEqual([]);
    expect(countOrphanTmuxSessions(annotated, false)).toBe(0);
  });
});
