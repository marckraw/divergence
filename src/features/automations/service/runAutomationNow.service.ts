import type { Project, RunBackgroundTask } from "../../../entities";
import {
  insertAutomationRun,
  markAutomationRunSchedule,
  updateAutomationRun,
  updateAutomationRunDivergence,
  updateAutomationRunTmuxSession,
  type Automation,
  type AutomationRunTriggerSource,
} from "../../../entities/automation";
import { loadProjectSettings } from "../../../entities/project";
import {
  createDivergenceRepository,
  insertDivergenceRecord,
} from "../../create-divergence";
import { writeAutomationBriefFile } from "../api/runAutomation.api";
import {
  spawnAutomationTmuxSession,
  queryAutomationTmuxPaneStatus,
  readAutomationLogTail,
  readAutomationResultFile,
  killAutomationTmuxSession,
} from "../api/tmuxAutomation.api";
import {
  buildAutomationLogPath,
  buildAutomationResultPath,
  buildAutomationTmuxSessionName,
  buildWrapperCommand,
  parseAutomationResult,
} from "../lib/tmuxAutomation.pure";
import type { AutomationResultFile } from "../lib/tmuxAutomation.types";
import {
  buildAutomationBranchName,
  buildAutomationPromptMarkdown,
  computeNextScheduledRunAtMs,
} from "../lib/automationScheduler.pure";
import { renderTemplateCommand } from "../../../shared";

const DEFAULT_POLL_INTERVAL_MS = 5_000;
const DEFAULT_MAX_POLL_DURATION_MS = 4 * 60 * 60 * 1000; // 4 hours
const LOG_TAIL_MAX_BYTES = 8_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface RunAutomationNowInput {
  automation: Automation;
  project: Pick<Project, "id" | "name" | "path"> | null;
  runTask: RunBackgroundTask;
  agentCommandClaude: string;
  agentCommandCodex: string;
  triggerSource?: AutomationRunTriggerSource;
}

export interface RunAutomationNowResult {
  runId: number;
  status: "launched" | "error";
  tmuxSessionName?: string;
  divergenceId?: number;
  error?: string;
}

export interface RunAutomationNowDependencies {
  insertAutomationRun: typeof insertAutomationRun;
  updateAutomationRun: typeof updateAutomationRun;
  updateAutomationRunTmuxSession: typeof updateAutomationRunTmuxSession;
  updateAutomationRunDivergence: typeof updateAutomationRunDivergence;
  markAutomationRunSchedule: typeof markAutomationRunSchedule;
  loadProjectSettings: typeof loadProjectSettings;
  createDivergenceRepository: typeof createDivergenceRepository;
  insertDivergenceRecord: typeof insertDivergenceRecord;
  buildAutomationPromptMarkdown: typeof buildAutomationPromptMarkdown;
  writeAutomationBriefFile: typeof writeAutomationBriefFile;
  spawnAutomationTmuxSession: typeof spawnAutomationTmuxSession;
  queryAutomationTmuxPaneStatus: typeof queryAutomationTmuxPaneStatus;
  readAutomationLogTail: typeof readAutomationLogTail;
  readAutomationResultFile: typeof readAutomationResultFile;
  killAutomationTmuxSession: typeof killAutomationTmuxSession;
  parseAutomationResult: typeof parseAutomationResult;
  now: () => number;
  pollIntervalMs: number;
  maxPollDurationMs: number;
}

export async function runAutomationNow(
  input: RunAutomationNowInput,
  dependencies: Partial<RunAutomationNowDependencies> = {}
): Promise<RunAutomationNowResult> {
  const deps: RunAutomationNowDependencies = {
    insertAutomationRun,
    updateAutomationRun,
    updateAutomationRunTmuxSession,
    updateAutomationRunDivergence,
    markAutomationRunSchedule,
    loadProjectSettings,
    createDivergenceRepository,
    insertDivergenceRecord,
    buildAutomationPromptMarkdown,
    writeAutomationBriefFile,
    spawnAutomationTmuxSession,
    queryAutomationTmuxPaneStatus,
    readAutomationLogTail,
    readAutomationResultFile,
    killAutomationTmuxSession,
    parseAutomationResult,
    now: Date.now,
    pollIntervalMs: DEFAULT_POLL_INTERVAL_MS,
    maxPollDurationMs: DEFAULT_MAX_POLL_DURATION_MS,
    ...dependencies,
  };

  const triggerSource = input.triggerSource ?? "manual";
  const startedAtMs = deps.now();
  const runId = await deps.insertAutomationRun({
    automationId: input.automation.id,
    triggerSource,
    status: "queued",
    startedAtMs,
    keepSessionAlive: input.automation.keepSessionAlive,
  });

  const project = input.project;
  if (!project) {
    const endedAtMs = deps.now();
    const errorMessage = `Project ${input.automation.projectId} was not found.`;
    await Promise.all([
      deps.updateAutomationRun(runId, {
        status: "error",
        startedAtMs,
        endedAtMs,
        error: errorMessage,
      }),
      deps.markAutomationRunSchedule(input.automation.id, {
        lastRunAtMs: endedAtMs,
        nextRunAtMs: computeNextScheduledRunAtMs(input.automation, endedAtMs),
      }),
    ]);
    return {
      runId,
      status: "error",
      error: errorMessage,
    };
  }

  // ── Create divergence (branch-isolated clone) ──
  let divergencePath: string;
  let divergenceId: number;
  try {
    const settings = await deps.loadProjectSettings(project.id);
    const branchName = buildAutomationBranchName(input.automation.id, input.automation.name, deps.now());
    const divergence = await deps.createDivergenceRepository({
      project,
      branchName,
      copyIgnoredSkip: settings.copyIgnoredSkip,
      useExistingBranch: false,
    });
    divergenceId = await deps.insertDivergenceRecord(divergence);
    await deps.updateAutomationRunDivergence(runId, divergenceId);
    divergencePath = divergence.path;
  } catch (err) {
    const endedAtMs = deps.now();
    const errorMessage = `Failed to create divergence: ${err instanceof Error ? err.message : String(err)}`;
    await Promise.all([
      deps.updateAutomationRun(runId, {
        status: "error",
        startedAtMs,
        endedAtMs,
        error: errorMessage,
      }),
      deps.markAutomationRunSchedule(input.automation.id, {
        lastRunAtMs: endedAtMs,
        nextRunAtMs: computeNextScheduledRunAtMs(input.automation, endedAtMs),
      }),
    ]);
    return {
      runId,
      status: "error",
      error: errorMessage,
    };
  }

  let dbFinalized = false;
  const precomputedTmuxSessionName = buildAutomationTmuxSessionName(input.automation.id, runId);

  try {
    await input.runTask<void>({
      kind: "automation_run",
      title: `Automation: ${input.automation.name}`,
      target: {
        type: "project",
        projectId: project.id,
        projectName: project.name,
        path: divergencePath,
        label: `${project.name} / ${input.automation.name}`,
        tmuxSessionName: precomputedTmuxSessionName,
      },
      origin: "automation_manual",
      fsHeavy: false,
      initialPhase: "Queued",
      successMessage: `Automation completed: ${input.automation.name}`,
      errorMessage: `Automation failed: ${input.automation.name}`,
      dbRunId: runId,
      run: async ({ setPhase, setOutputTail }) => {
        // ── Phase 1: Launch ──
        setPhase("Preparing prompt");
        const markdown = deps.buildAutomationPromptMarkdown({
          automationName: input.automation.name,
          projectName: project.name,
          triggerSource,
          prompt: input.automation.prompt,
          generatedAtMs: deps.now(),
        });
        const { path: briefPath } = await deps.writeAutomationBriefFile(divergencePath, markdown);

        const commandTemplate = input.automation.agent === "claude"
          ? input.agentCommandClaude
          : input.agentCommandCodex;
        if (!commandTemplate.trim()) {
          throw new Error(`No ${input.automation.agent} command template configured in settings.`);
        }

        const agentCommand = renderTemplateCommand(commandTemplate, {
          workspacePath: divergencePath,
          briefPath,
        });

        const tmuxSessionName = buildAutomationTmuxSessionName(input.automation.id, runId);
        const logPath = buildAutomationLogPath(divergencePath, runId);
        const resultPath = buildAutomationResultPath(divergencePath, runId);

        const wrapperCommand = buildWrapperCommand({
          agentCommand,
          logPath,
          resultPath,
          metadata: {
            automationName: input.automation.name,
            runId,
            automationId: input.automation.id,
            projectName: project.name,
            projectPath: project.path,
            divergencePath,
            agent: input.automation.agent,
            triggerSource,
            briefPath,
          },
        });

        setPhase("Spawning tmux session");
        await deps.spawnAutomationTmuxSession({
          sessionName: tmuxSessionName,
          command: wrapperCommand,
          cwd: divergencePath,
          logPath,
        });

        await Promise.all([
          deps.updateAutomationRun(runId, {
            status: "running",
            startedAtMs,
          }),
          deps.updateAutomationRunTmuxSession(runId, {
            tmuxSessionName,
            logFilePath: logPath,
            resultFilePath: resultPath,
          }),
        ]);

        // ── Phase 2: Monitor ──
        setPhase("Running agent");

        const result = await pollUntilDone({
          tmuxSessionName,
          logPath,
          resultPath,
          setOutputTail,
          pollIntervalMs: deps.pollIntervalMs,
          maxPollDurationMs: deps.maxPollDurationMs,
          now: deps.now,
          queryPaneStatus: deps.queryAutomationTmuxPaneStatus,
          readLogTail: deps.readAutomationLogTail,
          readResultFile: deps.readAutomationResultFile,
          parseResult: deps.parseAutomationResult,
        });

        // ── Phase 3: Finalize ──
        const endedAtMs = deps.now();

        // Read final log tail
        try {
          const finalLog = await deps.readAutomationLogTail(logPath, LOG_TAIL_MAX_BYTES);
          if (finalLog) setOutputTail(finalLog);
        } catch { /* ignore */ }

        // Kill tmux session (unless keepSessionAlive is enabled)
        if (!input.automation.keepSessionAlive) {
          try {
            await deps.killAutomationTmuxSession(tmuxSessionName);
          } catch { /* best-effort cleanup */ }
        }

        // Update schedule
        await deps.markAutomationRunSchedule(input.automation.id, {
          lastRunAtMs: endedAtMs,
          nextRunAtMs: computeNextScheduledRunAtMs(input.automation, endedAtMs),
        });

        if (result && result.exitCode === 0) {
          await deps.updateAutomationRun(runId, {
            status: "success",
            startedAtMs,
            endedAtMs,
          });
          dbFinalized = true;
          // Returns normally -> task center shows "Success"
        } else {
          const errorMsg = result
            ? `Agent exited with code ${result.exitCode}`
            : "Agent process ended without producing a result file.";
          await deps.updateAutomationRun(runId, {
            status: "error",
            startedAtMs,
            endedAtMs,
            error: errorMsg,
          });
          dbFinalized = true;
          throw new Error(errorMsg); // -> task center shows "Error"
        }
      },
    });

    return {
      runId,
      status: "launched",
      tmuxSessionName: buildAutomationTmuxSessionName(input.automation.id, runId),
      divergenceId,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (!dbFinalized) {
      // DB hasn't been finalized yet — this covers launch-phase errors and
      // unexpected monitoring-phase errors (e.g., poll timeout) that would
      // otherwise leave the run stuck in "running" status.
      const endedAtMs = deps.now();
      await Promise.all([
        deps.updateAutomationRun(runId, {
          status: "error",
          startedAtMs,
          endedAtMs,
          error: message,
        }),
        deps.markAutomationRunSchedule(input.automation.id, {
          lastRunAtMs: endedAtMs,
          nextRunAtMs: computeNextScheduledRunAtMs(input.automation, endedAtMs),
        }),
      ]);
    }

    return {
      runId,
      status: "error",
      error: message,
    };
  }
}

async function pollUntilDone(params: {
  tmuxSessionName: string;
  logPath: string;
  resultPath: string;
  setOutputTail: (tail: string) => void;
  pollIntervalMs: number;
  maxPollDurationMs: number;
  now: () => number;
  queryPaneStatus: typeof queryAutomationTmuxPaneStatus;
  readLogTail: typeof readAutomationLogTail;
  readResultFile: typeof readAutomationResultFile;
  parseResult: typeof parseAutomationResult;
}): Promise<AutomationResultFile | null> {
  const {
    tmuxSessionName,
    logPath,
    resultPath,
    setOutputTail,
    pollIntervalMs,
    maxPollDurationMs,
    now,
    queryPaneStatus,
    readLogTail,
    readResultFile,
    parseResult,
  } = params;

  const pollStartedAt = now();

  while (true) {
    if (now() - pollStartedAt >= maxPollDurationMs) {
      throw new Error(
        `Automation polling timed out after ${Math.round(maxPollDurationMs / 60_000)} minutes. ` +
        `The tmux session "${tmuxSessionName}" may still be running.`
      );
    }
    await sleep(pollIntervalMs);

    // Read log tail for live output
    try {
      const logTail = await readLogTail(logPath, LOG_TAIL_MAX_BYTES);
      if (logTail) {
        setOutputTail(logTail);
      }
    } catch {
      // Log read failure is non-fatal
    }

    // Check tmux pane status
    let paneStatus;
    try {
      paneStatus = await queryPaneStatus(tmuxSessionName);
    } catch {
      // Session disappeared — check result file
      try {
        const resultJson = await readResultFile(resultPath);
        if (resultJson) {
          return parseResult(resultJson);
        }
      } catch { /* ignore */ }
      return null;
    }

    if (paneStatus.alive) {
      // Secondary completion signal: check if result file exists even though
      // pane reports alive. This handles the case where the background poller
      // killed the session but tmux falls back to a parent session context.
      try {
        const resultJson = await readResultFile(resultPath);
        if (resultJson) {
          const earlyResult = parseResult(resultJson);
          if (earlyResult) return earlyResult;
        }
      } catch { /* ignore */ }
      continue;
    }

    // Process exited — read result file
    try {
      const resultJson = await readResultFile(resultPath);
      if (resultJson) {
        return parseResult(resultJson);
      }
    } catch { /* ignore */ }
    return null;
  }
}
