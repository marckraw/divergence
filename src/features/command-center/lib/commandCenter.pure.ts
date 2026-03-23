import type {
  AgentProvider,
  Divergence,
  Project,
  StagePaneId,
  Workspace,
  WorkspaceDivergence,
  WorkspaceSession,
} from "../../../entities";
import {
  getWorkspaceSessionTargetId,
  getWorkspaceSessionTargetType,
  isAgentSession,
} from "../../../entities";
import { getBaseName } from "../../../shared";
import type {
  CommandCenterCategory,
  CommandCenterCreateAction,
  CommandCenterMode,
  CommandCenterResultGroup,
  CommandCenterResultType,
  CommandCenterSearchResult,
  CommandCenterSessionResult,
  CommandCenterSourceContext,
  FileResult,
} from "../ui/CommandCenter.types";
import { buildCommandCenterCreateActions } from "./commandCenterActions.pure";

const RECENT_SESSION_LIMIT = 5;

function getFileInfo(relativePath: string): FileResult {
  const fileName = getBaseName(relativePath);
  const directory = relativePath.slice(0, Math.max(0, relativePath.length - fileName.length)).replace(/[/\\]$/, "");
  const dotIndex = fileName.lastIndexOf(".");
  const extension = dotIndex > 0 ? fileName.slice(dotIndex + 1) : "";

  return {
    id: relativePath,
    relativePath,
    fileName,
    directory,
    extension,
  };
}

function isSessionResultType(type: CommandCenterResultType): boolean {
  return type === "session";
}

function getSearchableValues(result: CommandCenterSearchResult): string[] {
  switch (result.type) {
    case "project":
      return [result.item.name];
    case "divergence":
      return [result.item.name, result.item.branch, result.projectName ?? ""];
    case "workspace":
      return [result.item.name, result.item.slug];
    case "workspace_divergence":
      return [result.item.name, result.item.branch, result.workspaceName ?? ""];
    case "session":
      return [
        result.item.name,
        result.item.path,
        result.item.sessionRole,
        result.projectName ?? "",
        result.workspaceName ?? "",
        isAgentSession(result.item) ? result.item.provider : result.item.type,
        isAgentSession(result.item) ? result.item.model : "",
      ];
    case "file":
      return [
        result.item.relativePath,
        result.item.fileName,
        result.item.directory,
        result.item.extension,
      ];
    case "create_action":
      return [result.item.label, result.item.description, result.item.provider ?? "", result.item.targetType];
  }
}

function matchesQuery(result: CommandCenterSearchResult, normalizedQuery: string): boolean {
  return getSearchableValues(result).some((value) => value.toLowerCase().includes(normalizedQuery));
}

function getResultLabel(result: CommandCenterSearchResult): string {
  switch (result.type) {
    case "divergence":
      return result.item.branch;
    case "workspace_divergence":
      return result.item.branch;
    case "file":
      return result.item.relativePath;
    case "create_action":
      return result.item.label;
    default:
      return result.item.name;
  }
}

function mapResultCategory(result: CommandCenterSearchResult): Exclude<CommandCenterCategory, "all"> {
  if (result.type === "file") {
    return "files";
  }
  if (result.type === "create_action") {
    return "create";
  }
  if (isSessionResultType(result.type)) {
    return "sessions";
  }
  return "navigation";
}

export function buildCommandCenterSourceContext(
  mode: CommandCenterMode,
  input: {
    sourceSession: WorkspaceSession | null;
    targetPaneId?: StagePaneId | null;
  },
): CommandCenterSourceContext {
  switch (mode.kind) {
    case "replace":
      return {
        badgeLabel: "Replace",
        description: input.sourceSession ? input.sourceSession.name : "Focused pane",
        targetPaneId: mode.targetPaneId,
      };
    case "reveal":
      return {
        badgeLabel: "Reveal",
        description: "Jump to an existing session",
      };
    case "open-file":
      return {
        badgeLabel: "File",
        description: input.sourceSession ? input.sourceSession.name : mode.rootPath,
        targetPaneId: mode.targetPaneId,
      };
    case "open-in-pane":
      return {
        badgeLabel: "Open",
        description: input.sourceSession ? input.sourceSession.name : "Pending pane",
        targetPaneId: mode.targetPaneId,
      };
  }
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
    agentProviders?: AgentProvider[];
    sourceSession?: WorkspaceSession | null;
  },
): CommandCenterSearchResult[] {
  const results: CommandCenterSearchResult[] = [];
  const projectById = new Map<number, Project>();
  const workspaceById = new Map<number, Workspace>();
  const sessions = Array.from(context.sessions.values());

  for (const project of context.projects) {
    projectById.set(project.id, project);
  }

  for (const workspace of context.workspaces ?? []) {
    workspaceById.set(workspace.id, workspace);
  }

  const fileResults = (context.files ?? []).map((relativePath) => ({
    type: "file" as const,
    item: getFileInfo(relativePath),
    category: "files" as const,
  }));

  const createActions = buildCommandCenterCreateActions(
    context.sourceSession ?? null,
    context.agentProviders ?? [],
  ).map((action) => ({
    type: "create_action" as const,
    item: action,
    category: "create" as const,
  }));

  if (mode.kind === "open-file") {
    return fileResults;
  }

  if (mode.kind === "reveal") {
    return sessions.map((session) => ({
      type: "session" as const,
      item: session,
      projectName: projectById.get(session.projectId)?.name,
      workspaceName: getWorkspaceSessionTargetType(session) === "divergence"
        ? (context.divergencesByProject.get(session.projectId) ?? [])
          .find((divergence) => divergence.id === getWorkspaceSessionTargetId(session))?.branch
        : undefined,
      category: "navigation" as const,
    }));
  }

  const recentSessions = sessions.slice(0, RECENT_SESSION_LIMIT);
  for (const session of recentSessions) {
    results.push({
      type: "session",
      item: session,
      projectName: projectById.get(session.projectId)?.name,
      workspaceName: getWorkspaceSessionTargetType(session) === "divergence"
        ? (context.divergencesByProject.get(session.projectId) ?? [])
          .find((divergence) => divergence.id === getWorkspaceSessionTargetId(session))?.branch
        : undefined,
      category: "recent",
    });
  }

  if (mode.kind === "replace") {
    for (const project of context.projects) {
      results.push({
        type: "project",
        item: project,
        category: "navigation",
      });

      for (const divergence of context.divergencesByProject.get(project.id) ?? []) {
        results.push({
          type: "divergence",
          item: divergence,
          projectName: project.name,
          category: "navigation",
        });
      }
    }

    for (const workspace of context.workspaces ?? []) {
      results.push({
        type: "workspace",
        item: workspace,
        category: "navigation",
      });
    }

    for (const workspaceDivergence of context.workspaceDivergences ?? []) {
      results.push({
        type: "workspace_divergence",
        item: workspaceDivergence,
        workspaceName: workspaceById.get(workspaceDivergence.workspaceId)?.name,
        category: "navigation",
      });
    }
  }

  for (const session of sessions) {
    if (recentSessions.some((item) => item.id === session.id)) {
      continue;
    }

    results.push({
      type: "session",
      item: session,
      projectName: projectById.get(session.projectId)?.name,
      workspaceName: getWorkspaceSessionTargetType(session) === "divergence"
        ? (context.divergencesByProject.get(session.projectId) ?? [])
          .find((divergence) => divergence.id === getWorkspaceSessionTargetId(session))?.branch
        : undefined,
      category: "navigation",
    });
  }

  if (mode.kind === "replace" || mode.kind === "open-in-pane") {
    results.push(...fileResults);
    results.push(...createActions);
  }

  return results;
}

export function filterCommandCenterSearchResults(
  items: CommandCenterSearchResult[],
  query: string,
  activeCategory: CommandCenterCategory = "all",
): CommandCenterSearchResult[] {
  const normalizedQuery = query.trim().toLowerCase();

  return items.filter((result) => {
    if (activeCategory !== "all" && mapResultCategory(result) !== activeCategory) {
      return false;
    }

    if (!normalizedQuery) {
      return true;
    }

    return matchesQuery(result, normalizedQuery);
  });
}

export function groupCommandCenterResults(
  items: CommandCenterSearchResult[],
): CommandCenterResultGroup[] {
  const groups: CommandCenterResultGroup[] = [];
  const groupOrder: CommandCenterSearchResult["category"][] = [
    "recent",
    "files",
    "navigation",
    "create",
  ];
  const headingByCategory: Record<CommandCenterSearchResult["category"], string> = {
    recent: "Recent Sessions",
    files: "Files",
    navigation: "Navigate",
    create: "Create New",
  };

  for (const category of groupOrder) {
    const results = items.filter((item) => item.category === category);
    if (results.length === 0) {
      continue;
    }

    groups.push({
      id: category,
      heading: headingByCategory[category],
      results,
    });
  }

  return groups;
}

export function getCommandCenterResultKey(result: CommandCenterSearchResult): string {
  switch (result.type) {
    case "file":
      return `file:${result.item.id}`;
    case "create_action":
      return `create:${result.item.id}`;
    default:
      return `${result.type}:${result.item.id}`;
  }
}

export function getCommandCenterSessionResult(
  sessions: Map<string, WorkspaceSession>,
  sessionId: string | undefined,
): CommandCenterSessionResult | null {
  if (!sessionId) {
    return null;
  }

  const session = sessions.get(sessionId);
  if (!session) {
    return null;
  }

  return {
    sessionId: session.id,
    path: session.path,
    targetType: getWorkspaceSessionTargetType(session),
    targetId: getWorkspaceSessionTargetId(session),
  };
}

export function getCommandCenterResultLabel(result: CommandCenterSearchResult): string {
  return getResultLabel(result);
}

export function isCommandCenterSessionCategory(result: CommandCenterSearchResult): boolean {
  return isSessionResultType(result.type);
}

export function isCommandCenterCreateAction(
  value: CommandCenterSearchResult["item"],
): value is CommandCenterCreateAction {
  return typeof value === "object" && value !== null && "sessionKind" in value;
}
