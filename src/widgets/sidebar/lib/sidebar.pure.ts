import type { Divergence, Project, TerminalSession } from "../../../entities";

export type SessionType = "project" | "divergence";

export function buildSessionId(type: SessionType, id: number): string {
  return `${type}-${id}`;
}

export function getExpandableProjectIds(
  projects: Project[],
  divergencesByProject: Map<number, Divergence[]>
): number[] {
  return projects
    .filter((project) => (divergencesByProject.get(project.id) ?? []).length > 0)
    .map((project) => project.id);
}

export function areAllExpanded(expandedProjects: Set<number>, expandableProjectIds: number[]): boolean {
  return expandableProjectIds.length > 0
    && expandableProjectIds.every((id) => expandedProjects.has(id));
}

export function toggleExpandedProjectId(current: Set<number>, projectId: number): Set<number> {
  const next = new Set(current);
  if (next.has(projectId)) {
    next.delete(projectId);
  } else {
    next.add(projectId);
  }
  return next;
}

export function toggleAllExpandedProjects(
  current: Set<number>,
  expandableProjectIds: number[]
): Set<number> {
  if (expandableProjectIds.length === 0) {
    return current;
  }

  const allExpanded = expandableProjectIds.every((id) => current.has(id));
  if (allExpanded) {
    return new Set();
  }
  return new Set(expandableProjectIds);
}

export function getSessionStatus(
  sessions: Map<string, TerminalSession>,
  type: SessionType,
  id: number
): TerminalSession["status"] | null {
  const workspaceSessions = getSessionsForWorkspace(sessions, type, id);
  if (workspaceSessions.some((session) => session.status === "busy")) {
    return "busy";
  }
  if (workspaceSessions.some((session) => session.status === "active")) {
    return "active";
  }
  if (workspaceSessions.length > 0) {
    return "idle";
  }
  return null;
}

export function getSessionsForWorkspace(
  sessions: Map<string, TerminalSession>,
  type: SessionType,
  id: number
): TerminalSession[] {
  return Array.from(sessions.values())
    .filter((session) => session.type === type && session.targetId === id)
    .sort((a, b) => {
      if (a.sessionRole !== b.sessionRole) {
        return a.sessionRole === "default" ? -1 : 1;
      }
      return a.id.localeCompare(b.id);
    });
}

export function isSessionActive(
  activeSessionId: string | null,
  sessions: Map<string, TerminalSession>,
  type: SessionType,
  id: number
): boolean {
  if (!activeSessionId) {
    return false;
  }
  const active = sessions.get(activeSessionId);
  if (!active) {
    return false;
  }
  return active.type === type && active.targetId === id;
}

export function isSessionItemActive(activeSessionId: string | null, sessionId: string): boolean {
  return activeSessionId === sessionId;
}

export function getProjectNameFromSelectedPath(selectedPath: string): string {
  return selectedPath.split("/").pop() || "Unnamed Project";
}
