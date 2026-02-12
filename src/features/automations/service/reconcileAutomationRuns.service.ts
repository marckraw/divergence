import {
  listRunningAutomationRuns,
  updateAutomationRun,
  markAutomationRunSchedule,
} from "../../../entities/automation/api/automation.api";
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
        run.keepSessionAlive
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
  keepSessionAlive: boolean
): Promise<void> {
  let paneStatus;
  try {
    paneStatus = await queryAutomationTmuxPaneStatus(tmuxSessionName);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message === "session_not_found") {
      // Session gone — check result file
      const resultJson = await readAutomationResultFile(resultFilePath);
      if (resultJson) {
        const result = parseAutomationResult(resultJson);
        if (result) {
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
            nextRunAtMs: null,
          });
          return;
        }
      }

      // Session gone, no result file
      const endedAtMs = Date.now();
      await updateAutomationRun(runId, {
        status: "error",
        endedAtMs,
        error: "Process lost during app restart.",
      });
      await markAutomationRunSchedule(automationId, {
        lastRunAtMs: endedAtMs,
        nextRunAtMs: null,
      });
      return;
    }
    throw error;
  }

  // Session alive + process running: do nothing — poller will handle
  if (paneStatus.alive) {
    return;
  }

  // Session alive + process dead: read result, update DB, kill session
  const resultJson = await readAutomationResultFile(resultFilePath);
  if (resultJson) {
    const result = parseAutomationResult(resultJson);
    if (result) {
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
        nextRunAtMs: null,
      });

      if (!keepSessionAlive) {
        try {
          await killAutomationTmuxSession(tmuxSessionName);
        } catch {
          // Best-effort cleanup
        }
      }
      return;
    }
  }

  // Process dead, no result
  const endedAtMs = Date.now();
  const exitCodeInfo = paneStatus.exitCode !== null
    ? ` (exit code: ${paneStatus.exitCode})`
    : "";
  await updateAutomationRun(runId, {
    status: "error",
    endedAtMs,
    error: `Process exited without writing result file${exitCodeInfo}.`,
  });
  await markAutomationRunSchedule(automationId, {
    lastRunAtMs: endedAtMs,
    nextRunAtMs: null,
  });

  if (!keepSessionAlive) {
    try {
      await killAutomationTmuxSession(tmuxSessionName);
    } catch {
      // Best-effort cleanup
    }
  }
}
