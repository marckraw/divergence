import type {
  Divergence,
  Project,
  WorkspaceSession,
  Workspace,
  WorkspaceDivergence,
} from "../../../entities";
import {
  getWorkspaceSessionTargetId,
  getWorkspaceSessionTargetType,
  isAgentSession,
} from "../../../entities";
import type {
  CommandCenterMode,
  CommandCenterCategory,
  CommandCenterSearchResult,
  FileResult,
} from "../ui/CommandCenter.types";
import { buildCommandCenterCreateActions } from "./commandCenterActions.pure";

export interface FilePathInfo {
  fileName: string;
  directory: string;
  extension: string;
}

export function getFileInfo(filePath: string): FilePathInfo {
  const lastSlash = Math.max(filePath.lastIndexOf("/"), filePath.lastIndexOf("\\"));
  const fileName = lastSlash >= 0 ? filePath.slice(lastSlash + 1) : filePath;
  const directory = lastSlash >= 0 ? filePath.slice(0, lastSlash) : "";
  const dotIndex = fileName.lastIndexOf(".");
  const extension = dotIndex > 0 ? fileName.slice(dotIndex + 1) : "";
  return { fileName, directory, extension };
}

export function joinRootWithRelativePath(rootPath: string, relativePath: string): string {
  const separator = rootPath.includes("\\") ? "\\" : "/";
  const trimmedRoot = rootPath.replace(/[/\\]+$/, "");
  const trimmedRelative = relativePath.replace(/^[/\\]+/, "");
  return `${trimmedRoot}${separator}${trimmedRelative}`;
}

export function buildCommandCenterSearchResults(
  mode: CommandCenterMode,
  context: {
    projects: Project[];
    divergencesByProject: Map<number, Divergence[]>;
    sessions: Map<string, WorkspaceSession>;
    workspaces?: Workspace[];
    workspaceDivergences?: WorkspaceDivergence[];
    files?: string[];
  },
): CommandCenterSearchResult[] {
  const items: CommandCenterSearchResult[] = [];

  if (mode.kind === "open-file") {
    return buildFileResults(context.files ?? []);
  }

  if (mode.kind === "reveal") {
    return buildRevealResults(context);
  }

  // "replace" and "open-in-pane" modes show everything
  const projectById = new Map<number, Project>();
  context.projects.forEach((project) => projectById.set(project.id, project));

  // Sessions first (recent)
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
      category: "recent",
    });
  }

  // Files (if available)
  if (context.files && context.files.length > 0) {
    items.push(...buildFileResults(context.files));
  }

  // Projects & divergences (navigation)
  if (mode.kind === "replace") {
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

  // Create actions
  const createActions = buildCommandCenterCreateActions();
  for (const action of createActions) {
    items.push({ type: "create_action", item: action, category: "create" });
  }

  return items;
}

function buildFileResults(files: string[]): CommandCenterSearchResult[] {
  return files.map((filePath) => {
    const info = getFileInfo(filePath);
    const fileResult: FileResult = {
      id: filePath,
      relativePath: filePath,
      fileName: info.fileName,
      directory: info.directory,
      extension: info.extension,
    };
    return {
      type: "file" as const,
      item: fileResult,
      category: "files" as const,
    };
  });
}

function buildRevealResults(context: {
  sessions: Map<string, WorkspaceSession>;
  workspaces?: Workspace[];
  workspaceDivergences?: WorkspaceDivergence[];
  projects: Project[];
  divergencesByProject: Map<number, Divergence[]>;
}): CommandCenterSearchResult[] {
  const items: CommandCenterSearchResult[] = [];
  const projectById = new Map<number, Project>();
  context.projects.forEach((project) => projectById.set(project.id, project));

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
      category: "recent",
    });
  }

  if (context.workspaces) {
    for (const workspace of context.workspaces) {
      items.push({ type: "workspace", item: workspace, category: "navigation" });
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

  if (activeCategory && activeCategory !== "all") {
    const categoryMap: Record<string, CommandCenterSearchResult["category"][]> = {
      files: ["files"],
      sessions: ["recent"],
      create: ["create"],
    };
    const allowedCategories = categoryMap[activeCategory];
    if (allowedCategories) {
      filtered = filtered.filter((item) => allowedCategories.includes(item.category));
    }
  }

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

  const name = (result.item as { name: string }).name.toLowerCase();

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
      || session.sessionRole.toLowerCase().includes(lowerQuery)
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

  return name.includes(lowerQuery);
}

export function groupResultsByCategory(
  items: CommandCenterSearchResult[],
): { label: string; items: CommandCenterSearchResult[] }[] {
  const groups: { label: string; category: CommandCenterSearchResult["category"]; items: CommandCenterSearchResult[] }[] = [
    { label: "Recent Sessions", category: "recent", items: [] },
    { label: "Files", category: "files", items: [] },
    { label: "Projects & Divergences", category: "navigation", items: [] },
    { label: "Create New", category: "create", items: [] },
  ];

  for (const item of items) {
    const group = groups.find((g) => g.category === item.category);
    if (group) {
      group.items.push(item);
    }
  }

  return groups.filter((g) => g.items.length > 0).map(({ label, items: groupItems }) => ({ label, items: groupItems }));
}
