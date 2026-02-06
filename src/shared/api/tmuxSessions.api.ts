import { invoke } from "@tauri-apps/api/core";
import type { TmuxSessionEntry } from "../../types";
import {
  buildLegacyTmuxSessionName,
  buildSplitTmuxSessionName,
  buildTmuxSessionName,
} from "../../lib/tmux";

interface TmuxDivergenceRef {
  id: number;
  project_id: number;
  branch: string;
}

export async function listTmuxSessions(): Promise<TmuxSessionEntry[]> {
  return invoke<TmuxSessionEntry[]>("list_tmux_sessions");
}

export async function killTmuxSession(sessionName: string): Promise<void> {
  await invoke("kill_tmux_session", { sessionName });
}

export async function killAllTmuxSessions(sessionNames: string[]): Promise<void> {
  await invoke("kill_all_tmux_sessions", { sessionNames });
}

export async function killProjectTmuxSessions(projectId: number, projectName: string): Promise<void> {
  const projectSessionName = buildTmuxSessionName({
    type: "project",
    projectName,
    projectId,
  });
  await invoke("kill_tmux_session", { sessionName: projectSessionName });
  await invoke("kill_tmux_session", {
    sessionName: buildSplitTmuxSessionName(projectSessionName, "pane-2"),
  });
  await invoke("kill_tmux_session", {
    sessionName: buildLegacyTmuxSessionName(`project-${projectId}`),
  });
}

export async function killDivergenceTmuxSessions(
  divergence: TmuxDivergenceRef,
  projectName: string
): Promise<void> {
  const divergenceSessionName = buildTmuxSessionName({
    type: "divergence",
    projectName,
    projectId: divergence.project_id,
    divergenceId: divergence.id,
    branch: divergence.branch,
  });
  await invoke("kill_tmux_session", { sessionName: divergenceSessionName });
  await invoke("kill_tmux_session", {
    sessionName: buildSplitTmuxSessionName(divergenceSessionName, "pane-2"),
  });
  await invoke("kill_tmux_session", {
    sessionName: buildLegacyTmuxSessionName(`divergence-${divergence.id}`),
  });
}
