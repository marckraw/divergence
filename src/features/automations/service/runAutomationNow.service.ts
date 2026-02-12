import type { Project, RunBackgroundTask } from "../../../entities";
import {
  insertAutomationRun,
  markAutomationRunSchedule,
  updateAutomationRun,
  updateAutomationRunTmuxSession,
  type Automation,
  type AutomationRunTriggerSource,
} from "../../../entities/automation";
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
import { computeNextScheduledRunAtMs } from "../lib/automationScheduler.pure";

const DEFAULT_POLL_INTERVAL_MS = 5_000;
const LOG_TAIL_MAX_BYTES = 8_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function renderAutomationCommand(template: string, tokens: {
  workspacePath: string;
  briefPath: string;
}): string {
  return template
    .split("{workspacePath}").join(tokens.workspacePath)
    .split("{briefPath}").join(tokens.briefPath);
}

function buildAutomationPromptMarkdown(input: {
  automationName: string;
  projectName: string;
  triggerSource: string;
  prompt: string;
  generatedAtMs: number;
}): string {
  return [
    `# Automation Run: ${input.automationName}`,
    "",
    `Project: ${input.projectName}`,
    `Trigger: ${input.triggerSource}`,
    `Generated at: ${new Date(input.generatedAtMs).toISOString()}`,
    "",
    "## Prompt",
    input.prompt.trim(),
    "",
  ].join("\n");
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
  error?: string;
}

export interface RunAutomationNowDependencies {
  insertAutomationRun: typeof insertAutomationRun;
  updateAutomationRun: typeof updateAutomationRun;
  updateAutomationRunTmuxSession: typeof updateAutomationRunTmuxSession;
  markAutomationRunSchedule: typeof markAutomationRunSchedule;
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
}

export async function runAutomationNow(
  input: RunAutomationNowInput,
  dependencies: Partial<RunAutomationNowDependencies> = {}
): Promise<RunAutomationNowResult> {
  const deps: RunAutomationNowDependencies = {
    insertAutomationRun,
    updateAutomationRun,
    updateAutomationRunTmuxSession,
    markAutomationRunSchedule,
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

  let monitoringStarted = false;
  const precomputedTmuxSessionName = buildAutomationTmuxSessionName(input.automation.id, runId);

  try {
    await input.runTask<void>({
      kind: "automation_run",
      title: `Automation: ${input.automation.name}`,
      target: {
        type: "project",
        projectId: project.id,
        projectName: project.name,
        path: project.path,
        label: `${project.name} / ${input.automation.name}`,
        tmuxSessionName: precomputedTmuxSessionName,
      },
      origin: "automation_manual",
      fsHeavy: false,
      initialPhase: "Queued",
      successMessage: `Automation completed: ${input.automation.name}`,
      errorMessage: `Automation failed: ${input.automation.name}`,
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
        const { path: briefPath } = await deps.writeAutomationBriefFile(project.path, markdown);

        const commandTemplate = input.automation.agent === "claude"
          ? input.agentCommandClaude
          : input.agentCommandCodex;
        if (!commandTemplate.trim()) {
          throw new Error(`No ${input.automation.agent} command template configured in settings.`);
        }

        const agentCommand = renderAutomationCommand(commandTemplate, {
          workspacePath: project.path,
          briefPath,
        });

        const tmuxSessionName = buildAutomationTmuxSessionName(input.automation.id, runId);
        const logPath = buildAutomationLogPath(project.path, runId);
        const resultPath = buildAutomationResultPath(project.path, runId);

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
            agent: input.automation.agent,
            triggerSource,
            briefPath,
          },
        });

        setPhase("Spawning tmux session");
        await deps.spawnAutomationTmuxSession({
          sessionName: tmuxSessionName,
          command: wrapperCommand,
          cwd: project.path,
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
        monitoringStarted = true;
        setPhase("Running agent");

        const result = await pollUntilDone({
          tmuxSessionName,
          logPath,
          resultPath,
          setOutputTail,
          pollIntervalMs: deps.pollIntervalMs,
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
          throw new Error(errorMsg); // -> task center shows "Error"
        }
      },
    });

    return {
      runId,
      status: "launched",
      tmuxSessionName: buildAutomationTmuxSessionName(input.automation.id, runId),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (!monitoringStarted) {
      // Launch-phase error — DB hasn't been finalized yet
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
    // If monitoringStarted, DB was already updated inside the run callback.

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
    queryPaneStatus,
    readLogTail,
    readResultFile,
    parseResult,
  } = params;

  while (true) {
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
