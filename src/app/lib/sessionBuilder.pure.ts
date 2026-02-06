import type { Project, Divergence, TerminalSession } from "../../entities";
import type { ProjectSettings } from "../../entities/project";
import { DEFAULT_USE_TMUX, DEFAULT_USE_WEBGL } from "../../entities/project";
import { buildTmuxSessionName } from "../../entities/terminal-session";

export interface BuildTerminalSessionInput {
  type: "project" | "divergence";
  target: Project | Divergence;
  settingsByProjectId: Map<number, ProjectSettings>;
  projectsById: Map<number, { name: string }>;
  globalTmuxHistoryLimit: number;
}

export function buildTerminalSession(input: BuildTerminalSessionInput): TerminalSession {
  const { type, target, settingsByProjectId, projectsById, globalTmuxHistoryLimit } = input;
  const projectId = type === "project" ? target.id : (target as Divergence).project_id;
  const projectSettings = settingsByProjectId.get(projectId);

  const useTmux = projectSettings?.useTmux ?? DEFAULT_USE_TMUX;
  const useWebgl = projectSettings?.useWebgl ?? DEFAULT_USE_WEBGL;
  const tmuxHistoryLimit = projectSettings?.tmuxHistoryLimit ?? globalTmuxHistoryLimit;

  const projectName = type === "project"
    ? (target as Project).name
    : projectsById.get(projectId)?.name ?? "project";

  const branchName = type === "divergence" ? (target as Divergence).branch : undefined;
  const tmuxSessionName = buildTmuxSessionName({
    type,
    projectName,
    projectId,
    divergenceId: type === "divergence" ? target.id : undefined,
    branch: branchName,
  });

  return {
    id: `${type}-${target.id}`,
    type,
    targetId: target.id,
    projectId,
    name: target.name,
    path: target.path,
    useTmux,
    tmuxSessionName,
    tmuxHistoryLimit,
    useWebgl,
    status: "idle",
  };
}
