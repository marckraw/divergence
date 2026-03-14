import { invoke } from "@tauri-apps/api/core";
import type {
  RawTmuxSessionEntry,
  TmuxDiagnosticsEntry,
  TmuxSessionEntry,
} from "./tmuxSessions.types";
import {
  buildLegacyTmuxSessionName,
  buildSplitTmuxSessionName,
  buildTmuxSessionName,
} from "../lib/tmux.pure";
import { SECONDARY_SPLIT_PANE_IDS } from "../lib/splitPaneIds.pure";

interface TmuxDivergenceRef {
  id: number;
  projectId: number;
  branch: string;
}

const TMUX_LIST_TIMEOUT_MS = 8_000;
const TMUX_DIAGNOSTICS_TIMEOUT_MS = 10_000;

let inflightListTmuxSessions: Promise<TmuxSessionEntry[]> | null = null;
let inflightTmuxDiagnostics: Promise<TmuxDiagnosticsEntry> | null = null;

function invalidateTmuxSessionListCache(): void {
  inflightListTmuxSessions = null;
}

function withTimeout<T>(
  operation: Promise<T>,
  timeoutMs: number,
  message: string
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(message));
    }, timeoutMs);

    operation
      .then((result) => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

export async function listTmuxSessions(): Promise<TmuxSessionEntry[]> {
  if (inflightListTmuxSessions) {
    return inflightListTmuxSessions;
  }

  const request = withTimeout(
    invoke<TmuxSessionEntry[]>("list_tmux_sessions"),
    TMUX_LIST_TIMEOUT_MS,
    `Timed out listing tmux sessions after ${Math.round(TMUX_LIST_TIMEOUT_MS / 1000)}s.`
  );
  inflightListTmuxSessions = request.finally(() => {
    if (inflightListTmuxSessions === request) {
      inflightListTmuxSessions = null;
    }
  });
  return inflightListTmuxSessions;
}

export async function listAllTmuxSessions(): Promise<RawTmuxSessionEntry[]> {
  return withTimeout(
    invoke<RawTmuxSessionEntry[]>("list_all_tmux_sessions"),
    TMUX_LIST_TIMEOUT_MS,
    `Timed out listing all tmux sessions after ${Math.round(TMUX_LIST_TIMEOUT_MS / 1000)}s.`
  );
}

export async function getTmuxDiagnostics(): Promise<TmuxDiagnosticsEntry> {
  if (inflightTmuxDiagnostics) {
    return inflightTmuxDiagnostics;
  }

  const request = withTimeout(
    invoke<TmuxDiagnosticsEntry>("get_tmux_diagnostics"),
    TMUX_DIAGNOSTICS_TIMEOUT_MS,
    `Timed out collecting tmux diagnostics after ${Math.round(TMUX_DIAGNOSTICS_TIMEOUT_MS / 1000)}s.`
  );
  inflightTmuxDiagnostics = request.finally(() => {
    if (inflightTmuxDiagnostics === request) {
      inflightTmuxDiagnostics = null;
    }
  });
  return inflightTmuxDiagnostics;
}

export async function killTmuxSession(
  sessionName: string,
  socketPath?: string
): Promise<void> {
  try {
    await invoke("kill_tmux_session", {
      sessionName,
      socketPath: socketPath ?? null,
    });
  } finally {
    invalidateTmuxSessionListCache();
  }
}

export async function killAllTmuxSessions(sessionNames: string[]): Promise<void> {
  try {
    await invoke("kill_all_tmux_sessions", { sessionNames });
  } finally {
    invalidateTmuxSessionListCache();
  }
}

export async function killProjectTmuxSessions(projectId: number, projectName: string): Promise<void> {
  const projectSessionName = buildTmuxSessionName({
    type: "project",
    projectName,
    projectId,
  });
  await invoke("kill_tmux_session", { sessionName: projectSessionName });
  for (const paneId of SECONDARY_SPLIT_PANE_IDS) {
    await invoke("kill_tmux_session", {
      sessionName: buildSplitTmuxSessionName(projectSessionName, paneId),
    });
  }
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
    projectId: divergence.projectId,
    divergenceId: divergence.id,
    branch: divergence.branch,
  });
  await invoke("kill_tmux_session", { sessionName: divergenceSessionName });
  for (const paneId of SECONDARY_SPLIT_PANE_IDS) {
    await invoke("kill_tmux_session", {
      sessionName: buildSplitTmuxSessionName(divergenceSessionName, paneId),
    });
  }
  await invoke("kill_tmux_session", {
    sessionName: buildLegacyTmuxSessionName(`divergence-${divergence.id}`),
  });
}
