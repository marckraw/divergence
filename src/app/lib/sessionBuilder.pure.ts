import type { Project, Divergence, TerminalSession, Workspace, WorkspaceDivergence, PortAllocation } from "../../entities";
import type { ProjectSettings } from "../../entities/project";
import { DEFAULT_USE_TMUX } from "../../entities/project";
import { buildTmuxSessionName } from "../../entities/terminal-session";
import { buildPortEnvVars } from "../../entities/port-management";

export interface BuildTerminalSessionInput {
  type: "project" | "divergence";
  target: Project | Divergence;
  settingsByProjectId: Map<number, ProjectSettings>;
  projectsById: Map<number, { name: string }>;
  globalTmuxHistoryLimit: number;
  sessionId?: string;
  sessionName?: string;
  sessionRole?: TerminalSession["sessionRole"];
  workspaceKey?: string;
  tmuxSessionName?: string;
  portAllocation?: PortAllocation | null;
}

export interface BuildWorkspaceSessionInput {
  workspace: Workspace;
  globalTmuxHistoryLimit: number;
  sessionId?: string;
  sessionName?: string;
  sessionRole?: TerminalSession["sessionRole"];
  tmuxSessionName?: string;
}

export interface BuildWorkspaceDivergenceSessionInput {
  workspaceDivergence: WorkspaceDivergence;
  globalTmuxHistoryLimit: number;
  sessionId?: string;
  sessionName?: string;
  sessionRole?: TerminalSession["sessionRole"];
  tmuxSessionName?: string;
  portAllocation?: PortAllocation | null;
}

export function generateSessionEntropy(): string {
  return `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

export function buildWorkspaceKey(type: "project" | "divergence" | "workspace" | "workspace_divergence", targetId: number): string {
  return `${type}:${targetId}`;
}

export function buildTerminalSession(input: BuildTerminalSessionInput): TerminalSession {
  const { type, target, settingsByProjectId, projectsById, globalTmuxHistoryLimit } = input;
  const projectId = type === "project" ? target.id : (target as Divergence).projectId;
  const projectSettings = settingsByProjectId.get(projectId);

  const useTmux = projectSettings?.useTmux ?? DEFAULT_USE_TMUX;
  const tmuxHistoryLimit = projectSettings?.tmuxHistoryLimit ?? globalTmuxHistoryLimit;

  const projectName = type === "project"
    ? (target as Project).name
    : projectsById.get(projectId)?.name ?? "project";

  const branchName = type === "divergence" ? (target as Divergence).branch : undefined;
  const tmuxSessionName = input.tmuxSessionName ?? buildTmuxSessionName({
    type,
    projectName,
    projectId,
    divergenceId: type === "divergence" ? target.id : undefined,
    branch: branchName,
  });

  const portAllocation = input.portAllocation ?? null;
  const portEnv = portAllocation
    ? buildPortEnvVars(portAllocation.port, portAllocation.framework, portAllocation.proxyHostname)
    : undefined;

  return {
    id: input.sessionId ?? `${type}-${target.id}`,
    type,
    targetId: target.id,
    projectId,
    workspaceKey: input.workspaceKey ?? buildWorkspaceKey(type, target.id),
    sessionRole: input.sessionRole ?? "default",
    name: input.sessionName ?? target.name,
    path: target.path,
    useTmux,
    tmuxSessionName,
    tmuxHistoryLimit,
    status: "idle",
    portEnv,
  };
}

export function buildWorkspaceTerminalSession(input: BuildWorkspaceSessionInput): TerminalSession {
  const { workspace, globalTmuxHistoryLimit } = input;
  const tmuxSessionName = input.tmuxSessionName ?? buildTmuxSessionName({
    type: "workspace",
    projectName: workspace.name,
    projectId: workspace.id,
  });

  return {
    id: input.sessionId ?? `workspace-${workspace.id}`,
    type: "workspace",
    targetId: workspace.id,
    projectId: 0,
    workspaceOwnerId: workspace.id,
    workspaceKey: buildWorkspaceKey("workspace", workspace.id),
    sessionRole: input.sessionRole ?? "default",
    name: input.sessionName ?? workspace.name,
    path: workspace.folderPath,
    useTmux: true,
    tmuxSessionName,
    tmuxHistoryLimit: globalTmuxHistoryLimit,
    status: "idle",
  };
}

export function buildWorkspaceDivergenceTerminalSession(input: BuildWorkspaceDivergenceSessionInput): TerminalSession {
  const { workspaceDivergence, globalTmuxHistoryLimit } = input;
  const tmuxSessionName = input.tmuxSessionName ?? buildTmuxSessionName({
    type: "workspace_divergence",
    projectName: workspaceDivergence.name,
    projectId: workspaceDivergence.id,
  });

  const portAllocation = input.portAllocation ?? null;
  const portEnv = portAllocation
    ? buildPortEnvVars(portAllocation.port, portAllocation.framework, portAllocation.proxyHostname)
    : undefined;

  return {
    id: input.sessionId ?? `workspace_divergence-${workspaceDivergence.id}`,
    type: "workspace_divergence",
    targetId: workspaceDivergence.id,
    projectId: 0,
    workspaceOwnerId: workspaceDivergence.workspaceId,
    workspaceKey: buildWorkspaceKey("workspace_divergence", workspaceDivergence.id),
    sessionRole: input.sessionRole ?? "default",
    name: input.sessionName ?? workspaceDivergence.name,
    path: workspaceDivergence.folderPath,
    useTmux: true,
    tmuxSessionName,
    tmuxHistoryLimit: globalTmuxHistoryLimit,
    status: "idle",
    portEnv,
  };
}
