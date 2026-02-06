import type { Divergence, Project, TerminalSession } from "../../types";

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
  return sessions.get(buildSessionId(type, id))?.status ?? null;
}

export function isSessionActive(activeSessionId: string | null, type: SessionType, id: number): boolean {
  return activeSessionId === buildSessionId(type, id);
}

export function getProjectNameFromSelectedPath(selectedPath: string): string {
  return selectedPath.split("/").pop() || "Unnamed Project";
}
