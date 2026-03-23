import type {
  AgentProvider,
  Divergence,
  Project,
  StageTab,
  Workspace,
  WorkspaceDivergence,
  WorkspaceSession,
} from "../../../entities";
import {
  getFocusedPane,
  getWorkspaceSessionTargetId,
  getWorkspaceSessionTargetType,
  isAgentSession,
  isEditorSession,
} from "../../../entities";
import type {
  CommandCenterCategory,
  CommandCenterMode,
  CommandCenterSearchResult,
  FileResult,
} from "../ui/CommandCenter.types";
import { buildCommandCenterCreateActions } from "./commandCenterActions.pure";

export interface CommandCenterContext {
  projects: Project[];
  divergencesByProject: Map<number, Divergence[]>;
  sessions: Map<string, WorkspaceSession>;
  workspaces?: Workspace[];
  workspaceDivergences?: WorkspaceDivergence[];
  stageTabs?: StageTab[];
  files?: string[];
  agentProviders?: AgentProvider[];
  sourceSession?: WorkspaceSession | null;
}

export function buildCommandCenterSearchResults(
  mode: CommandCenterMode,
  context: CommandCenterContext,
): CommandCenterSearchResult[] {
  const items: CommandCenterSearchResult[] = [];
  const projectById = new Map<number, Project>();
  context.projects.forEach((project) => projectById.set(project.id, project));

  if (mode.kind === "replace" || mode.kind === "open-in-pane") {
    // Sessions (recent)
    const sessionsList = Array.from(context.sessions.values()).sort((a, b) => a.name.localeCompare(b.name));
    for (const session of sessionsList) {
      const projectName = projectById.get(session.projectId)?.name;
      const targetType = getWorkspaceSessionTargetType(session);
      const targetId = getWorkspaceSessionTargetId(session);
      const workspaceName = targetType === "divergence"
        ? (context.divergencesByProject.get(session.projectId) ?? []).find((item) => item.id === targetId)?.branch
        : projectName;
      items.push({
        type: "session",
        item: session,
        projectName,
        workspaceName,
        detail: isEditorSession(session) ? session.filePath : undefined,
        category: "recent",
      });
    }
  }

  if (mode.kind === "reveal") {
    // Sessions
    const sessionsList = Array.from(context.sessions.values()).sort((a, b) => a.name.localeCompare(b.name));
    for (const session of sessionsList) {
      const projectName = projectById.get(session.projectId)?.name;
      const targetType = getWorkspaceSessionTargetType(session);
      const targetId = getWorkspaceSessionTargetId(session);
      const workspaceName = targetType === "divergence"
        ? (context.divergencesByProject.get(session.projectId) ?? []).find((item) => item.id === targetId)?.branch
        : projectName;
      items.push({
        type: "session",
        item: session,
        projectName,
        workspaceName,
        detail: isEditorSession(session) ? session.filePath : undefined,
        category: "recent",
      });
    }

    // Stage tabs
    if (context.stageTabs) {
      const sortedTabs = [...context.stageTabs].sort((a, b) => a.label.localeCompare(b.label));
      for (const tab of sortedTabs) {
        const focusedPane = getFocusedPane(tab.layout);
        const focusedLabel = focusedPane.ref.kind === "pending"
          ? "Empty pane"
          : context.sessions.get(focusedPane.ref.sessionId)?.name ?? focusedPane.ref.sessionId;
        items.push({
          type: "stage_tab",
          item: tab,
          detail: `${tab.layout.panes.length} pane${tab.layout.panes.length === 1 ? "" : "s"} • Focused: ${focusedLabel}`,
          category: "navigation",
        });
      }
    }

    // Workspaces
    if (context.workspaces) {
      for (const workspace of context.workspaces) {
        items.push({ type: "workspace", item: workspace, category: "navigation" });
      }
    }

    return items;
  }

  if (mode.kind === "open-file") {
    // Files only
    if (context.files) {
      for (const filePath of context.files) {
        items.push({
          type: "file",
          item: buildFileResult(filePath),
          category: "files",
        });
      }
    }
    return items;
  }

  // replace and open-in-pane: files
  if (context.files) {
    for (const filePath of context.files) {
      items.push({
        type: "file",
        item: buildFileResult(filePath),
        category: "files",
      });
    }
  }

  if (mode.kind === "replace") {
    // Projects & divergences
    for (const project of context.projects) {
      items.push({ type: "project", item: project, category: "navigation" });

      const divergences = context.divergencesByProject.get(project.id) || [];
      for (const divergence of divergences) {
        items.push({
          type: "divergence",
          item: divergence,
          projectName: project.name,
          category: "navigation",
        });
      }
    }

    // Workspaces
    if (context.workspaces) {
      const workspaceById = new Map<number, Workspace>();
      context.workspaces.forEach((ws) => workspaceById.set(ws.id, ws));

      for (const workspace of context.workspaces) {
        items.push({ type: "workspace", item: workspace, category: "navigation" });
      }

      if (context.workspaceDivergences) {
        for (const wd of context.workspaceDivergences) {
          const parentWs = workspaceById.get(wd.workspaceId);
          items.push({
            type: "workspace_divergence",
            item: wd,
            workspaceName: parentWs?.name,
            category: "navigation",
          });
        }
      }
    }
  }

  // Create actions for replace and open-in-pane
  if (mode.kind === "replace" || mode.kind === "open-in-pane") {
    const createActions = buildCommandCenterCreateActions(
      context.sourceSession ?? null,
      context.agentProviders ?? [],
    );
    for (const action of createActions) {
      items.push({
        type: "create_action",
        item: action,
        category: "create",
      });
    }
  }

  return items;
}

export function filterCommandCenterSearchResults(
  items: CommandCenterSearchResult[],
  query: string,
  activeCategory?: CommandCenterCategory,
): CommandCenterSearchResult[] {
  let filtered = items;

  // Category filter
  if (activeCategory && activeCategory !== "all") {
    filtered = filtered.filter((result) => {
      switch (activeCategory) {
        case "files":
          return result.type === "file";
        case "sessions":
          return result.type === "session" || result.type === "stage_tab"
            || result.type === "project" || result.type === "divergence"
            || result.type === "workspace" || result.type === "workspace_divergence";
        case "create":
          return result.type === "create_action";
        default:
          return true;
      }
    });
  }

  // Text filter
  if (!query.trim()) {
    return filtered;
  }

  const lowerQuery = query.toLowerCase();
  return filtered.filter((result) => matchesQuery(result, lowerQuery));
}

function matchesQuery(result: CommandCenterSearchResult, lowerQuery: string): boolean {
  if (result.type === "file") {
    const file = result.item as FileResult;
    return file.relativePath.toLowerCase().includes(lowerQuery);
  }

  if (result.type === "create_action") {
    const action = result.item as { label: string; description: string };
    return (
      action.label.toLowerCase().includes(lowerQuery)
      || action.description.toLowerCase().includes(lowerQuery)
    );
  }

  const name = "name" in result.item
    ? (result.item as { name: string }).name.toLowerCase()
    : "label" in result.item
      ? (result.item as { label: string }).label.toLowerCase()
      : "";

  if (result.type === "divergence") {
    const divergence = result.item as Divergence;
    return (
      name.includes(lowerQuery)
      || divergence.branch.toLowerCase().includes(lowerQuery)
      || (result.projectName?.toLowerCase().includes(lowerQuery) ?? false)
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
      || (result.projectName?.toLowerCase().includes(lowerQuery) ?? false)
      || (result.workspaceName?.toLowerCase().includes(lowerQuery) ?? false)
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
      || (result.workspaceName?.toLowerCase().includes(lowerQuery) ?? false)
    );
  }

  if (result.type === "stage_tab") {
    return (
      name.includes(lowerQuery)
      || (result.detail?.toLowerCase().includes(lowerQuery) ?? false)
    );
  }

  return name.includes(lowerQuery);
}

function buildFileResult(filePath: string): FileResult {
  const lastSlash = Math.max(filePath.lastIndexOf("/"), filePath.lastIndexOf("\\"));
  const fileName = lastSlash >= 0 ? filePath.slice(lastSlash + 1) : filePath;
  const directory = lastSlash >= 0 ? filePath.slice(0, lastSlash) : "";
  const dotIndex = fileName.lastIndexOf(".");
  const extension = dotIndex > 0 ? fileName.slice(dotIndex + 1) : "";
  return { id: filePath, relativePath: filePath, fileName, directory, extension };
}

export function getFileAbsolutePath(rootPath: string, relativePath: string): string {
  const separator = rootPath.includes("\\") ? "\\" : "/";
  const trimmedRoot = rootPath.replace(/[/\\]+$/, "");
  const trimmedRelative = relativePath.replace(/^[/\\]+/, "");
  return `${trimmedRoot}${separator}${trimmedRelative}`;
}

export function getCommandCenterContextLabel(
  mode: CommandCenterMode,
  sourceSession: WorkspaceSession | null,
): string {
  if (mode.kind === "open-file") {
    return mode.rootPath;
  }
  if (sourceSession) {
    return sourceSession.name;
  }
  return "";
}

export function getModeBadgeLabel(mode: CommandCenterMode): string {
  switch (mode.kind) {
    case "replace":
      return "Replace";
    case "reveal":
      return "Reveal";
    case "open-in-pane":
      return "Open";
    case "open-file":
      return "File";
  }
}

export function groupResultsByCategory(
  items: CommandCenterSearchResult[],
): { category: string; label: string; items: CommandCenterSearchResult[] }[] {
  const groups: { category: string; label: string; items: CommandCenterSearchResult[] }[] = [];
  const byCategory = new Map<string, CommandCenterSearchResult[]>();

  for (const item of items) {
    const existing = byCategory.get(item.category);
    if (existing) {
      existing.push(item);
    } else {
      byCategory.set(item.category, [item]);
    }
  }

  const categoryLabels: Record<string, string> = {
    recent: "Recent Sessions",
    files: "Files",
    navigation: "Projects & Divergences",
    create: "Create New",
  };
  const categoryOrder = ["recent", "files", "navigation", "create"];

  for (const cat of categoryOrder) {
    const catItems = byCategory.get(cat);
    if (catItems && catItems.length > 0) {
      groups.push({ category: cat, label: categoryLabels[cat] ?? cat, items: catItems });
    }
  }

  return groups;
}
