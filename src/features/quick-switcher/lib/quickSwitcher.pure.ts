import type {
  Divergence,
  Project,
  StageTab,
  WorkspaceSession,
  Workspace,
  WorkspaceDivergence,
} from "../../../entities";
import {
  getFocusedPane,
  getWorkspaceSessionTargetId,
  getWorkspaceSessionTargetType,
  isAgentSession,
  isEditorSession,
} from "../../../entities";

export interface QuickSwitcherSearchResult {
  type: "project" | "divergence" | "session" | "workspace" | "workspace_divergence" | "stage_tab";
  item: Project | Divergence | WorkspaceSession | Workspace | WorkspaceDivergence | StageTab;
  projectName?: string;
  workspaceName?: string;
  detail?: string;
}

export function buildQuickSwitcherSearchResults(
  projects: Project[],
  divergencesByProject: Map<number, Divergence[]>,
  sessions: Map<string, WorkspaceSession>,
  workspaces?: Workspace[],
  workspaceDivergences?: WorkspaceDivergence[],
  stageTabs?: StageTab[],
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
      detail: isEditorSession(session) ? session.filePath : undefined,
    });
  }

  if (stageTabs) {
    const sortedTabs = [...stageTabs].sort((a, b) => a.label.localeCompare(b.label));
    for (const tab of sortedTabs) {
      const focusedPane = getFocusedPane(tab.layout);
      const focusedLabel = focusedPane.ref.kind === "pending"
        ? "Empty pane"
        : sessions.get(focusedPane.ref.sessionId)?.name ?? focusedPane.ref.sessionId;
      items.push({
        type: "stage_tab",
        item: tab,
        detail: `${tab.layout.panes.length} pane${tab.layout.panes.length === 1 ? "" : "s"} • Focused: ${focusedLabel}`,
      });
    }
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
    const name = "name" in result.item
      ? result.item.name.toLowerCase()
      : result.item.label.toLowerCase();
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
        || (isEditorSession(session)
          ? session.filePath.toLowerCase().includes(lowerQuery)
          : "sessionRole" in session
            ? session.sessionRole.toLowerCase().includes(lowerQuery)
            : false)
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
    if (result.type === "stage_tab") {
      return (
        name.includes(lowerQuery)
        || result.detail?.toLowerCase().includes(lowerQuery)
      );
    }
    return name.includes(lowerQuery);
  });
}
