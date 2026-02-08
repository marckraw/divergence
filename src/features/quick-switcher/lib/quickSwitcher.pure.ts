import type { Divergence, Project, TerminalSession } from "../../../entities";

export interface QuickSwitcherSearchResult {
  type: "project" | "divergence" | "session";
  item: Project | Divergence | TerminalSession;
  projectName?: string;
  workspaceName?: string;
}

export function buildQuickSwitcherSearchResults(
  projects: Project[],
  divergencesByProject: Map<number, Divergence[]>,
  sessions: Map<string, TerminalSession>
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

  const sessionsList = Array.from(sessions.values()).sort((a, b) => a.name.localeCompare(b.name));
  for (const session of sessionsList) {
    const projectName = projectById.get(session.projectId)?.name;
    const workspaceName = session.type === "divergence"
      ? (divergencesByProject.get(session.projectId) ?? []).find((item) => item.id === session.targetId)?.branch
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
      const session = result.item as TerminalSession;
      return (
        name.includes(lowerQuery)
        || session.path.toLowerCase().includes(lowerQuery)
        || session.sessionRole.toLowerCase().includes(lowerQuery)
        || result.projectName?.toLowerCase().includes(lowerQuery)
        || result.workspaceName?.toLowerCase().includes(lowerQuery)
      );
    }
    return name.includes(lowerQuery);
  });
}
