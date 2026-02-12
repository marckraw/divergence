import { invoke } from "@tauri-apps/api/core";
import type { AutomationTmuxStatus } from "../lib/tmuxAutomation.types";

export async function spawnAutomationTmuxSession(params: {
  sessionName: string;
  command: string;
  cwd: string;
  logPath: string;
  envVars?: [string, string][];
}): Promise<void> {
  await invoke("spawn_tmux_automation_session", {
    sessionName: params.sessionName,
    command: params.command,
    cwd: params.cwd,
    logPath: params.logPath,
    envVars: params.envVars ?? [],
  });
}

export async function queryAutomationTmuxPaneStatus(
  sessionName: string
): Promise<AutomationTmuxStatus> {
  return invoke<AutomationTmuxStatus>("query_tmux_pane_status", {
    sessionName,
  });
}

export async function readAutomationLogTail(
  path: string,
  maxBytes: number
): Promise<string | null> {
  return invoke<string | null>("read_file_tail", { path, maxBytes });
}

export async function readAutomationResultFile(
  path: string
): Promise<string | null> {
  return invoke<string | null>("read_file_if_exists", { path });
}

export { killTmuxSession as killAutomationTmuxSession } from "../../../shared/api/tmuxSessions.api";
