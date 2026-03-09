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
import {
  getAgentRuntimeSession,
  type AgentRuntimeProvider,
  type AgentRuntimeSessionSnapshot,
} from "../../../shared";

interface AutomationRunRuntimeDetails {
  runtime?: string;
  agentSessionId?: string;
  provider?: AgentRuntimeProvider;
}

function parseRunRuntimeDetails(detailsJson: string | null): AutomationRunRuntimeDetails | null {
  if (!detailsJson?.trim()) {
    return null;
  }

  try {
    return JSON.parse(detailsJson) as AutomationRunRuntimeDetails;
  } catch {
    return null;
  }
}

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
    try {
      const runtimeDetails = parseRunRuntimeDetails(run.detailsJson);
      if (runtimeDetails?.runtime === "agent" && runtimeDetails.agentSessionId) {
        await reconcileAgentRuntimeRun(
          run.id,
          run.automationId,
          runtimeDetails.agentSessionId,
          automationById,
        );
        continue;
      }

      if (!run.tmuxSessionName || !run.resultFilePath) {
        await updateAutomationRun(run.id, {
          status: "error",
          endedAtMs: Date.now(),
          error: "Process lost during app restart (no recoverable runtime metadata).",
        });
        continue;
      }

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

async function reconcileAgentRuntimeRun(
  runId: number,
  automationId: number,
  agentSessionId: string,
  automationById: Map<number, Automation>,
): Promise<void> {
  const session = await getAgentRuntimeSession(agentSessionId);
  const automation = automationById.get(automationId);

  if (!session) {
    const endedAtMs = Date.now();
    await updateAutomationRun(runId, {
      status: "error",
      endedAtMs,
      error: "Automation agent session was missing on restart.",
    });
    await markAutomationRunSchedule(automationId, {
      lastRunAtMs: endedAtMs,
      nextRunAtMs: automation
        ? computeNextScheduledRunAtMs(automation, endedAtMs)
        : null,
    });
    return;
  }

  if (session.runtimeStatus === "running" || session.runtimeStatus === "waiting") {
    return;
  }

  await finalizeAgentRuntimeRun(runId, automationId, session, automationById);
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
            nextRunAtMs: automation
              ? computeNextScheduledRunAtMs(automation, endedAtMs)
              : null,
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
        nextRunAtMs: automation
          ? computeNextScheduledRunAtMs(automation, endedAtMs)
          : null,
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
        nextRunAtMs: automation
          ? computeNextScheduledRunAtMs(automation, endedAtMs)
          : null,
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
    nextRunAtMs: automation
      ? computeNextScheduledRunAtMs(automation, endedAtMs)
      : null,
  });

  if (!keepSessionAlive) {
    try {
      await killAutomationTmuxSession(tmuxSessionName);
    } catch {
      // Best-effort cleanup
    }
  }
}

async function finalizeAgentRuntimeRun(
  runId: number,
  automationId: number,
  session: AgentRuntimeSessionSnapshot,
  automationById: Map<number, Automation>,
): Promise<void> {
  const automation = automationById.get(automationId);
  const endedAtMs = Date.now();
  const output = [...session.messages]
    .reverse()
    .find((message) => message.role === "assistant" && message.content.trim().length > 0)
    ?.content;

  if (session.runtimeStatus === "error" || session.runtimeStatus === "stopped") {
    await updateAutomationRun(runId, {
      status: "error",
      endedAtMs,
      error: session.errorMessage ?? "Automation agent session failed.",
      detailsJson: JSON.stringify({
        runtime: "agent",
        agentSessionId: session.id,
        provider: session.provider,
        output,
      }),
    });
  } else {
    await updateAutomationRun(runId, {
      status: "success",
      endedAtMs,
      detailsJson: JSON.stringify({
        runtime: "agent",
        agentSessionId: session.id,
        provider: session.provider,
        output,
      }),
    });
  }

  await markAutomationRunSchedule(automationId, {
    lastRunAtMs: endedAtMs,
    nextRunAtMs: automation
      ? computeNextScheduledRunAtMs(automation, endedAtMs)
      : null,
  });
}
