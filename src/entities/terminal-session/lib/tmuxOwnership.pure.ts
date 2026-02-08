import type {
  Divergence,
} from "../../divergence";
import type {
  Project,
} from "../../project";
import type {
  TmuxSessionEntry,
  TmuxSessionOwnership,
  TmuxSessionWithOwnership,
} from "../model/tmux.types";
import {
  buildLegacyTmuxSessionName,
  buildSplitTmuxSessionName,
  buildTmuxSessionName,
} from "../../../shared/lib/tmux.pure";

export function buildTmuxOwnershipMap(
  projects: Project[],
  divergencesByProject: Map<number, Divergence[]>
): Map<string, TmuxSessionOwnership> {
  const map = new Map<string, TmuxSessionOwnership>();

  for (const project of projects) {
    const ownership: TmuxSessionOwnership = { kind: "project", project };

    const baseName = buildTmuxSessionName({
      type: "project",
      projectName: project.name,
      projectId: project.id,
    });
    map.set(baseName, ownership);
    map.set(buildSplitTmuxSessionName(baseName, "pane-2"), ownership);
    map.set(buildLegacyTmuxSessionName(`project-${project.id}`), ownership);

    const divergences = divergencesByProject.get(project.id) ?? [];
    for (const divergence of divergences) {
      const divergenceOwnership: TmuxSessionOwnership = {
        kind: "divergence",
        project,
        divergence,
      };

      const divergenceBase = buildTmuxSessionName({
        type: "divergence",
        projectName: project.name,
        projectId: project.id,
        divergenceId: divergence.id,
        branch: divergence.branch,
      });
      map.set(divergenceBase, divergenceOwnership);
      map.set(buildSplitTmuxSessionName(divergenceBase, "pane-2"), divergenceOwnership);
      map.set(buildLegacyTmuxSessionName(`divergence-${divergence.id}`), divergenceOwnership);
    }
  }

  return map;
}

export function annotateTmuxSessions(
  rawSessions: TmuxSessionEntry[],
  ownershipMap: Map<string, TmuxSessionOwnership>,
  ownershipReady: boolean
): TmuxSessionWithOwnership[] {
  if (!ownershipReady) {
    return rawSessions.map((session) => ({
      ...session,
      ownership: { kind: "unknown" },
    }));
  }

  return rawSessions.map((session) => ({
    ...session,
    ownership: ownershipMap.get(session.name) ?? { kind: "orphan" },
  }));
}

export function countOrphanTmuxSessions(
  sessions: TmuxSessionWithOwnership[],
  ownershipReady: boolean
): number {
  if (!ownershipReady) {
    return 0;
  }

  return sessions.filter((session) => session.ownership.kind === "orphan").length;
}
