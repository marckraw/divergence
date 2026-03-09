import { useEffect, useRef, useCallback } from "react";
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
  readAutomationLogTail,
  readAutomationResultFile,
  killAutomationTmuxSession,
} from "../api/tmuxAutomation.api";
import { parseAutomationResult } from "../lib/tmuxAutomation.pure";
import type { AutomationResultFile } from "../lib/tmuxAutomation.types";
import {
  getAgentRuntimeSession,
  type AgentRuntimeProvider,
  type AgentRuntimeSessionSnapshot,
} from "../../../shared";

const DEFAULT_POLLING_INTERVAL_MS = 5_000;
const LOG_TAIL_MAX_BYTES = 4_000;

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

export interface AutomationRunPollerCallbacks {
  onRunCompleted: (runId: number, result: AutomationResultFile) => void;
  onRunFailed: (runId: number, error: string) => void;
  onOutputUpdate: (runId: number, outputTail: string) => void;
}

export function useAutomationRunPoller(options: {
  pollingIntervalMs?: number;
  onRunCompleted: (runId: number, result: AutomationResultFile) => void;
  onRunFailed: (runId: number, error: string) => void;
  onOutputUpdate: (runId: number, outputTail: string) => void;
}): void {
  const intervalMs = options.pollingIntervalMs ?? DEFAULT_POLLING_INTERVAL_MS;
  const callbacksRef = useRef<AutomationRunPollerCallbacks>(options);
  callbacksRef.current = options;

  const pollingRef = useRef(false);

  const tick = useCallback(async () => {
    if (pollingRef.current) {
      return;
    }
    pollingRef.current = true;

    try {
      const runningRuns = await listRunningAutomationRuns();
      if (runningRuns.length === 0) {
        return;
      }

      for (const run of runningRuns) {
        try {
          const runtimeDetails = parseRunRuntimeDetails(run.detailsJson);
          if (runtimeDetails?.runtime === "agent" && runtimeDetails.agentSessionId) {
            await pollAgentRun(
              run.id,
              run.automationId,
              runtimeDetails.agentSessionId,
              callbacksRef.current
            );
          } else if (run.tmuxSessionName && run.logFilePath && run.resultFilePath) {
            await pollSingleRun(
              run.id,
              run.automationId,
              run.tmuxSessionName,
              run.logFilePath,
              run.resultFilePath,
              run.keepSessionAlive,
              callbacksRef.current
            );
          }
        } catch (error) {
          console.warn(`Poller error for run ${run.id}:`, error);
        }
      }
    } catch (error) {
      console.warn("Automation run poller tick failed:", error);
    } finally {
      pollingRef.current = false;
    }
  }, []);

  useEffect(() => {
    const timerId = window.setInterval(() => {
      void tick();
    }, intervalMs);

    return () => {
      window.clearInterval(timerId);
    };
  }, [tick, intervalMs]);
}

async function pollAgentRun(
  runId: number,
  automationId: number,
  agentSessionId: string,
  callbacks: AutomationRunPollerCallbacks
): Promise<void> {
  let cachedAutomation: Automation | undefined | null = null;
  async function getAutomation(): Promise<Automation | undefined> {
    if (cachedAutomation === null) {
      const allAutomations = await listAutomations();
      cachedAutomation = allAutomations.find((automation) => automation.id === automationId);
    }
    return cachedAutomation;
  }

  const session = await getAgentRuntimeSession(agentSessionId);
  if (!session) {
    const endedAtMs = Date.now();
    await updateAutomationRun(runId, {
      status: "error",
      endedAtMs,
      error: "Automation agent session disappeared.",
    });
    const automation = await getAutomation();
    await markAutomationRunSchedule(automationId, {
      lastRunAtMs: endedAtMs,
      nextRunAtMs: automation
        ? computeNextScheduledRunAtMs(automation, endedAtMs)
        : null,
    });
    callbacks.onRunFailed(runId, "Automation agent session disappeared.");
    return;
  }

  const outputTail = getAgentOutputTail(session);
  if (outputTail) {
    callbacks.onOutputUpdate(runId, outputTail);
  }

  if (session.pendingRequest) {
    const endedAtMs = Date.now();
    const error = `Automation requires interactive input: ${session.pendingRequest.title}`;
    await updateAutomationRun(runId, {
      status: "error",
      endedAtMs,
      error,
    });
    const automation = await getAutomation();
    await markAutomationRunSchedule(automationId, {
      lastRunAtMs: endedAtMs,
      nextRunAtMs: automation
        ? computeNextScheduledRunAtMs(automation, endedAtMs)
        : null,
    });
    callbacks.onRunFailed(runId, error);
    return;
  }

  if (session.runtimeStatus === "running" || session.runtimeStatus === "waiting") {
    return;
  }

  const endedAtMs = Date.now();
  const automation = await getAutomation();
  const output = getAgentOutputTail(session);
  if (session.runtimeStatus === "error" || session.runtimeStatus === "stopped") {
    const error = session.errorMessage ?? "Automation agent session failed.";
    await updateAutomationRun(runId, {
      status: "error",
      endedAtMs,
      error,
      detailsJson: JSON.stringify({
        runtime: "agent",
        agentSessionId: session.id,
        provider: session.provider,
        output,
      }),
    });
    await markAutomationRunSchedule(automationId, {
      lastRunAtMs: endedAtMs,
      nextRunAtMs: automation
        ? computeNextScheduledRunAtMs(automation, endedAtMs)
        : null,
    });
    callbacks.onRunFailed(runId, error);
    return;
  }

  const syntheticResult: AutomationResultFile = {
    status: "completed",
    exitCode: 0,
    startedAt: new Date(session.createdAtMs).toISOString(),
    finishedAt: new Date(endedAtMs).toISOString(),
  };
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
  await markAutomationRunSchedule(automationId, {
    lastRunAtMs: endedAtMs,
    nextRunAtMs: automation
      ? computeNextScheduledRunAtMs(automation, endedAtMs)
      : null,
  });
  callbacks.onRunCompleted(runId, syntheticResult);
}

async function pollSingleRun(
  runId: number,
  automationId: number,
  tmuxSessionName: string,
  logFilePath: string,
  resultFilePath: string,
  keepSessionAlive: boolean,
  callbacks: AutomationRunPollerCallbacks
): Promise<void> {
  // Lazy-cached automation lookup: fetches the full list at most once per poll
  // cycle and reuses the result across all code paths that need it.
  let cachedAutomation: Automation | undefined | null = null; // null = not yet fetched
  async function getAutomation(): Promise<Automation | undefined> {
    if (cachedAutomation === null) {
      const allAutomations = await listAutomations();
      cachedAutomation = allAutomations.find(a => a.id === automationId);
    }
    return cachedAutomation;
  }

  let paneStatus;
  try {
    paneStatus = await queryAutomationTmuxPaneStatus(tmuxSessionName);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message === "session_not_found") {
      // Session disappeared — check if result file exists before marking as error
      const resultJson = await readAutomationResultFile(resultFilePath);
      if (resultJson) {
        const result = parseAutomationResult(resultJson);
        if (result) {
          await finalizeRun(runId, automationId, result, tmuxSessionName, keepSessionAlive, callbacks, getAutomation);
          return;
        }
      }
      // Session gone and no result: mark as error
      const endedAtMs = Date.now();
      await updateAutomationRun(runId, {
        status: "error",
        endedAtMs,
        error: "Process lost — tmux session disappeared.",
      });
      const automation = await getAutomation();
      await markAutomationRunSchedule(automationId, {
        lastRunAtMs: endedAtMs,
        nextRunAtMs: automation
          ? computeNextScheduledRunAtMs(automation, endedAtMs)
          : null,
      });
      callbacks.onRunFailed(runId, "Process lost — tmux session disappeared.");
      return;
    }
    throw error;
  }

  // Read log tail for output update
  const logTail = await readAutomationLogTail(logFilePath, LOG_TAIL_MAX_BYTES);
  if (logTail) {
    callbacks.onOutputUpdate(runId, logTail);
  }

  // If process still running, nothing else to do
  if (paneStatus.alive) {
    return;
  }

  // Process exited — read result file
  const resultJson = await readAutomationResultFile(resultFilePath);
  if (resultJson) {
    const result = parseAutomationResult(resultJson);
    if (result) {
      await finalizeRun(runId, automationId, result, tmuxSessionName, keepSessionAlive, callbacks, getAutomation);
      return;
    }
  }

  // Process dead but no result file — mark as error
  const endedAtMs = Date.now();
  const exitCodeInfo = paneStatus.exitCode !== null
    ? ` (exit code: ${paneStatus.exitCode})`
    : "";
  await updateAutomationRun(runId, {
    status: "error",
    endedAtMs,
    error: `Process exited without writing result file${exitCodeInfo}.`,
  });
  const automation = await getAutomation();
  await markAutomationRunSchedule(automationId, {
    lastRunAtMs: endedAtMs,
    nextRunAtMs: automation
      ? computeNextScheduledRunAtMs(automation, endedAtMs)
      : null,
  });
  callbacks.onRunFailed(runId, `Process exited without writing result file${exitCodeInfo}.`);

  if (!keepSessionAlive) {
    try {
      await killAutomationTmuxSession(tmuxSessionName);
    } catch {
      // Cleanup best-effort
    }
  }
}

async function finalizeRun(
  runId: number,
  automationId: number,
  result: AutomationResultFile,
  tmuxSessionName: string,
  keepSessionAlive: boolean,
  callbacks: AutomationRunPollerCallbacks,
  getAutomation: () => Promise<Automation | undefined>
): Promise<void> {
  const endedAtMs = Date.now();
  const status = result.exitCode === 0 ? "success" : "error";
  const error = result.exitCode !== 0
    ? `Agent exited with code ${result.exitCode}.`
    : undefined;

  await updateAutomationRun(runId, {
    status,
    endedAtMs,
    error: error ?? null,
    detailsJson: JSON.stringify(result),
  });
  const automation = await getAutomation();
  await markAutomationRunSchedule(automationId, {
    lastRunAtMs: endedAtMs,
    nextRunAtMs: automation
      ? computeNextScheduledRunAtMs(automation, endedAtMs)
      : null,
  });

  if (status === "success") {
    callbacks.onRunCompleted(runId, result);
  } else {
    callbacks.onRunFailed(runId, error ?? "Unknown error");
  }

  if (!keepSessionAlive) {
    try {
      await killAutomationTmuxSession(tmuxSessionName);
    } catch {
      // Cleanup best-effort
    }
  }
}

function getAgentOutputTail(session: AgentRuntimeSessionSnapshot): string {
  const assistantMessage = [...session.messages]
    .reverse()
    .find((message) => message.role === "assistant" && message.content.trim().length > 0);
  if (assistantMessage) {
    return assistantMessage.content;
  }

  const activityWithDetails = [...session.activities]
    .reverse()
    .find((activity) => Boolean(activity.details?.trim()));
  return activityWithDetails?.details ?? "";
}
