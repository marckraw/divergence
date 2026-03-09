import type { Divergence, Project, WorkspaceSession, Workspace, WorkspaceDivergence } from "../../../entities";
import {
  getWorkspaceSessionTargetId,
  getWorkspaceSessionTargetType,
  isAgentSession,
} from "../../../entities";

export interface QuickSwitcherSearchResult {
  type: "project" | "divergence" | "session" | "workspace" | "workspace_divergence";
  item: Project | Divergence | WorkspaceSession | Workspace | WorkspaceDivergence;
  projectName?: string;
  workspaceName?: string;
}

export function buildQuickSwitcherSearchResults(
  projects: Project[],
  divergencesByProject: Map<number, Divergence[]>,
  sessions: Map<string, WorkspaceSession>,
  workspaces?: Workspace[],
  workspaceDivergences?: WorkspaceDivergence[],
): QuickSwitcherSearchResult[] {
  const items: QuickSwitcherSearchResult[] = [];
  const projectById = new Map<number, Project>();
  projects.forEach((project) => projectById.set(project.id, project));

  for (const project of projects) {
    items.push({ type: "project", item: project });

    const divergences = divergencesByProject.get(project.id) || [];
    for (const divergence of divergences) {
      items.push({
        type: "divergence",
        item: divergence,
        projectName: project.name,
      });
    }
  }

  if (workspaces) {
    const workspaceById = new Map<number, Workspace>();
    workspaces.forEach((ws) => workspaceById.set(ws.id, ws));

    for (const workspace of workspaces) {
      items.push({ type: "workspace", item: workspace });
    }

    if (workspaceDivergences) {
      for (const wd of workspaceDivergences) {
        const parentWs = workspaceById.get(wd.workspaceId);
        items.push({
          type: "workspace_divergence",
          item: wd,
          workspaceName: parentWs?.name,
        });
      }
    }
  }

  const sessionsList = Array.from(sessions.values()).sort((a, b) => a.name.localeCompare(b.name));
  for (const session of sessionsList) {
    const projectName = projectById.get(session.projectId)?.name;
    const targetType = getWorkspaceSessionTargetType(session);
    const targetId = getWorkspaceSessionTargetId(session);
    const workspaceName = targetType === "divergence"
      ? (divergencesByProject.get(session.projectId) ?? []).find((item) => item.id === targetId)?.branch
      : projectName;
    items.push({
      type: "session",
      item: session,
      projectName,
      workspaceName,
    });
  }

  return items;
}

export function filterQuickSwitcherSearchResults(
  items: QuickSwitcherSearchResult[],
  query: string
): QuickSwitcherSearchResult[] {
  if (!query.trim()) {
    return items;
  }

  const lowerQuery = query.toLowerCase();
  return items.filter((result) => {
    const name = result.item.name.toLowerCase();
    if (result.type === "divergence") {
      const divergence = result.item as Divergence;
      return (
        name.includes(lowerQuery)
        || divergence.branch.toLowerCase().includes(lowerQuery)
        || result.projectName?.toLowerCase().includes(lowerQuery)
      );
    }
    if (result.type === "session") {
      const session = result.item as WorkspaceSession;
      return (
        name.includes(lowerQuery)
        || session.path.toLowerCase().includes(lowerQuery)
        || session.sessionRole.toLowerCase().includes(lowerQuery)
        || (isAgentSession(session)
          ? (
            session.provider.toLowerCase().includes(lowerQuery)
            || session.model.toLowerCase().includes(lowerQuery)
          )
          : false)
        || result.projectName?.toLowerCase().includes(lowerQuery)
        || result.workspaceName?.toLowerCase().includes(lowerQuery)
      );
    }
    if (result.type === "workspace") {
      const workspace = result.item as Workspace;
      return (
        name.includes(lowerQuery)
        || workspace.slug.toLowerCase().includes(lowerQuery)
      );
    }
    if (result.type === "workspace_divergence") {
      const wd = result.item as WorkspaceDivergence;
      return (
        name.includes(lowerQuery)
        || wd.branch.toLowerCase().includes(lowerQuery)
        || result.workspaceName?.toLowerCase().includes(lowerQuery)
      );
    }
    return name.includes(lowerQuery);
  });
}
