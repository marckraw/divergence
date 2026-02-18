import {
  listAutomations,
  listRunningAutomationRuns,
  updateAutomationRun,
  markAutomationRunSchedule,
  type Automation,
} from "../../../entities/automation";
import { computeNextScheduledRunAtMs } from "../lib/automationScheduler.pure";
import {
  queryAutomationTmuxPaneStatus,
  readAutomationResultFile,
  killAutomationTmuxSession,
} from "../api/tmuxAutomation.api";
import { parseAutomationResult } from "../lib/tmuxAutomation.pure";

export async function reconcileAutomationRuns(): Promise<void> {
  const runningRuns = await listRunningAutomationRuns();
  if (runningRuns.length === 0) {
    return;
  }

  const allAutomations = await listAutomations();
  const automationById = new Map<number, Automation>();
  for (const a of allAutomations) {
    automationById.set(a.id, a);
  }

  for (const run of runningRuns) {
    if (!run.tmuxSessionName || !run.resultFilePath) {
      // Legacy run without tmux info — mark as error
      await updateAutomationRun(run.id, {
        status: "error",
        endedAtMs: Date.now(),
        error: "Process lost during app restart (no tmux session info).",
      });
      continue;
    }

    try {
      await reconcileSingleRun(
        run.id,
        run.automationId,
        run.tmuxSessionName,
        run.resultFilePath,
        run.keepSessionAlive,
        automationById,
      );
    } catch (error) {
      console.warn(`Reconciliation error for run ${run.id}:`, error);
      await updateAutomationRun(run.id, {
        status: "error",
        endedAtMs: Date.now(),
        error: `Reconciliation failed: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }
}

async function reconcileSingleRun(
  runId: number,
  automationId: number,
  tmuxSessionName: string,
  resultFilePath: string,
  keepSessionAlive: boolean,
  automationById: Map<number, Automation>,
): Promise<void> {
  const automation = automationById.get(automationId);

  let paneStatus;
  try {
    paneStatus = await queryAutomationTmuxPaneStatus(tmuxSessionName);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message === "session_not_found") {
      // Session gone — check result file
      if (await tryCompleteRunFromResult(runId, automationId, resultFilePath, automation)) {
        return;
      }

      // Session gone, no result file
      await markRunErrorAndSchedule(
        runId,
        automationId,
        "Process lost during app restart.",
        automation
      );
      return;
    }
    throw error;
  }

  // Session alive + process running: do nothing — poller will handle
  if (paneStatus.alive) {
    return;
  }

  // Session alive + process dead: read result, update DB, kill session
  if (await tryCompleteRunFromResult(runId, automationId, resultFilePath, automation)) {
    await cleanupTmuxSession(tmuxSessionName, keepSessionAlive);
    return;
  }

  // Process dead, no result
  const exitCodeInfo = paneStatus.exitCode !== null
    ? ` (exit code: ${paneStatus.exitCode})`
    : "";
  await markRunErrorAndSchedule(
    runId,
    automationId,
    `Process exited without writing result file${exitCodeInfo}.`,
    automation
  );
  await cleanupTmuxSession(tmuxSessionName, keepSessionAlive);
}

function computeScheduledNextRunAtMs(
  automation: Automation | undefined,
  endedAtMs: number
): number | null {
  return automation
    ? computeNextScheduledRunAtMs(automation, endedAtMs)
    : null;
}

async function markRunErrorAndSchedule(
  runId: number,
  automationId: number,
  error: string,
  automation: Automation | undefined
): Promise<void> {
  const endedAtMs = Date.now();
  await updateAutomationRun(runId, {
    status: "error",
    endedAtMs,
    error,
  });
  await markAutomationRunSchedule(automationId, {
    lastRunAtMs: endedAtMs,
    nextRunAtMs: computeScheduledNextRunAtMs(automation, endedAtMs),
  });
}

async function tryCompleteRunFromResult(
  runId: number,
  automationId: number,
  resultFilePath: string,
  automation: Automation | undefined
): Promise<boolean> {
  const resultJson = await readAutomationResultFile(resultFilePath);
  if (!resultJson) {
    return false;
  }

  const result = parseAutomationResult(resultJson);
  if (!result) {
    return false;
  }

  const endedAtMs = Date.now();
  const status = result.exitCode === 0 ? "success" : "error";
  await updateAutomationRun(runId, {
    status,
    endedAtMs,
    error: result.exitCode !== 0 ? `Agent exited with code ${result.exitCode}.` : null,
    detailsJson: JSON.stringify(result),
  });
  await markAutomationRunSchedule(automationId, {
    lastRunAtMs: endedAtMs,
    nextRunAtMs: computeScheduledNextRunAtMs(automation, endedAtMs),
  });
  return true;
}

async function cleanupTmuxSession(
  tmuxSessionName: string,
  keepSessionAlive: boolean
): Promise<void> {
  if (keepSessionAlive) {
    return;
  }
  try {
    await killAutomationTmuxSession(tmuxSessionName);
  } catch {
    // Best-effort cleanup
  }
}
