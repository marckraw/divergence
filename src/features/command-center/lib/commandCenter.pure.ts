import type {
  AgentProvider,
  Divergence,
  Project,
  Workspace,
  WorkspaceDivergence,
  WorkspaceSession,
} from "../../../entities";
import {
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
import { fuzzyMatch, fuzzyMatchPath } from "./fuzzyMatch.pure";

export interface CommandCenterContext {
  projects: Project[];
  divergencesByProject: Map<number, Divergence[]>;
  sessions: Map<string, WorkspaceSession>;
  workspaces?: Workspace[];
  workspaceDivergences?: WorkspaceDivergence[];
  files?: string[];
  agentProviders?: AgentProvider[];
  sourceSession?: WorkspaceSession | null;
}

export const MAX_VISIBLE_RESULTS = 100;

export function buildCommandCenterSearchResults(
  mode: CommandCenterMode,
  context: CommandCenterContext,
): CommandCenterSearchResult[] {
  const items: CommandCenterSearchResult[] = [];
  const projectById = new Map<number, Project>();
  context.projects.forEach((project) => projectById.set(project.id, project));
  const workspaceById = new Map<number, Workspace>();
  context.workspaces?.forEach((workspace) => workspaceById.set(workspace.id, workspace));

  if (mode.kind === "reveal" || mode.kind === "open-in-pane") {
    // Sessions (recent)
    const sessionsList = Array.from(context.sessions.values()).sort((a, b) => a.name.localeCompare(b.name));
    for (const session of sessionsList) {
      if (isEditorSession(session)) {
        continue;
      }
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

  // open-in-pane: files
  if (context.files) {
    for (const filePath of context.files) {
      items.push({
        type: "file",
        item: buildFileResult(filePath),
        category: "files",
      });
    }
  }

  // Create actions for explicit pane placement
  if (mode.kind === "open-in-pane") {
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
          return result.type === "session"
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

  const matchedEntries: { index: number; result: CommandCenterSearchResult }[] = [];
  filtered.forEach((result, index) => {
    const match = getResultMatch(result, query);
    if (!match.match) {
      return;
    }

    matchedEntries.push({
      index,
      result: {
        ...result,
        score: match.score,
        matchedIndices: match.matchedIndices,
      },
    });
  });

  return matchedEntries
    .sort((left, right) => {
      const categoryDelta = getCategorySortIndex(left.result.category) - getCategorySortIndex(right.result.category);
      if (categoryDelta !== 0) {
        return categoryDelta;
      }

      const scoreDelta = (right.result.score ?? 0) - (left.result.score ?? 0);
      if (scoreDelta !== 0) {
        return scoreDelta;
      }

      return left.index - right.index;
    })
    .map((entry) => entry.result);
}

function getResultMatch(
  result: CommandCenterSearchResult,
  query: string,
): { match: boolean; score: number; matchedIndices?: number[] } {
  if (result.type === "file") {
    const file = result.item as FileResult;
    const fileNameMatch = fuzzyMatch(query, file.fileName);
    if (fileNameMatch.match) {
      const pathMatch = fuzzyMatchPath(query, file.relativePath);
      return {
        match: true,
        score: pathMatch.score,
        matchedIndices: fileNameMatch.matchedIndices,
      };
    }

    const pathMatch = fuzzyMatchPath(query, file.relativePath);
    return pathMatch.match ? { match: true, score: pathMatch.score } : { match: false, score: 0 };
  }

  if (result.type === "create_action") {
    const action = result.item as { label: string; description: string };
    return findBestMatch(query, [
      { text: action.label, shouldHighlight: true },
      { text: action.description },
    ]);
  }

  if (result.type === "divergence") {
    const divergence = result.item as Divergence;
    return findBestMatch(query, [
      { text: divergence.branch, shouldHighlight: true },
      { text: divergence.name },
      { text: result.projectName },
    ]);
  }

  if (result.type === "session") {
    const session = result.item as WorkspaceSession;
    return findBestMatch(query, [
      { text: session.name, shouldHighlight: true },
      { text: session.path },
      { text: isEditorSession(session) ? session.filePath : undefined },
      { text: "sessionRole" in session ? session.sessionRole : undefined },
      { text: isAgentSession(session) ? session.provider : undefined },
      { text: isAgentSession(session) ? session.model : undefined },
      { text: result.projectName },
      { text: result.workspaceName },
    ]);
  }

  if (result.type === "workspace") {
    const workspace = result.item as Workspace;
    return findBestMatch(query, [
      { text: workspace.name, shouldHighlight: true },
      { text: workspace.slug },
    ]);
  }

  if (result.type === "workspace_divergence") {
    const wd = result.item as WorkspaceDivergence;
    return findBestMatch(query, [
      { text: wd.branch, shouldHighlight: true },
      { text: wd.name },
      { text: result.workspaceName },
    ]);
  }

  const name = "name" in result.item
    ? (result.item as { name: string }).name
    : "label" in result.item
      ? (result.item as { label: string }).label
      : "";

  return findBestMatch(query, [{ text: name, shouldHighlight: true }]);
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
    recent: "Sessions",
    files: "Files",
    navigation: "Targets",
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

function findBestMatch(
  query: string,
  candidates: { text?: string; shouldHighlight?: boolean }[],
): { match: boolean; score: number; matchedIndices?: number[] } {
  let bestMatch: { match: boolean; score: number; matchedIndices?: number[] } | null = null;

  for (const candidate of candidates) {
    if (!candidate.text) {
      continue;
    }

    const nextMatch = fuzzyMatch(query, candidate.text);
    if (!nextMatch.match) {
      continue;
    }

    const annotatedMatch = {
      match: true,
      score: nextMatch.score,
      matchedIndices: candidate.shouldHighlight ? nextMatch.matchedIndices : undefined,
    };

    if (!bestMatch || annotatedMatch.score > bestMatch.score) {
      bestMatch = annotatedMatch;
      continue;
    }

    if (
      annotatedMatch.score === bestMatch.score
      && annotatedMatch.matchedIndices
      && !bestMatch.matchedIndices
    ) {
      bestMatch = annotatedMatch;
    }
  }

  return bestMatch ?? { match: false, score: 0 };
}

function getCategorySortIndex(category: CommandCenterSearchResult["category"]): number {
  switch (category) {
    case "recent":
      return 0;
    case "files":
      return 1;
    case "navigation":
      return 2;
    case "create":
      return 3;
    default:
      return Number.MAX_SAFE_INTEGER;
  }
}
