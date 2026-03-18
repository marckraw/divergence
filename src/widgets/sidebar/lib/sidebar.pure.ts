import type { Divergence, Project, WorkspaceSession } from "../../../entities";
import {
  getWorkspaceSessionTargetId,
  getWorkspaceSessionTargetType,
  isAgentSession,
} from "../../../entities";

export type SessionType = "project" | "divergence" | "workspace" | "workspace_divergence";

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
  sessions: Map<string, WorkspaceSession>,
  type: SessionType,
  id: number
): WorkspaceSession["status"] | null {
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
  sessions: Map<string, WorkspaceSession>,
  type: SessionType,
  id: number
): WorkspaceSession[] {
  return Array.from(sessions.values())
    .filter((session) => getWorkspaceSessionTargetType(session) === type && getWorkspaceSessionTargetId(session) === id)
    .sort((a, b) => {
      if (isAgentSession(a) && isAgentSession(b)) {
        if (a.isOpen !== b.isOpen) {
          return a.isOpen ? -1 : 1;
        }
        return b.createdAtMs - a.createdAtMs;
      }
      if (isAgentSession(a) !== isAgentSession(b)) {
        return isAgentSession(a) ? 1 : -1;
      }
      if (a.sessionRole !== b.sessionRole) {
        return a.sessionRole === "default" ? -1 : 1;
      }
      return a.id.localeCompare(b.id);
    });
}

export function isSessionActive(
  activeSessionId: string | null,
  sessions: Map<string, WorkspaceSession>,
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
  return getWorkspaceSessionTargetType(active) === type && getWorkspaceSessionTargetId(active) === id;
}

export function isSessionItemActive(activeSessionId: string | null, sessionId: string): boolean {
  return activeSessionId === sessionId;
}

export function getProjectNameFromSelectedPath(selectedPath: string): string {
  return selectedPath.split("/").pop() || "Unnamed Project";
}
