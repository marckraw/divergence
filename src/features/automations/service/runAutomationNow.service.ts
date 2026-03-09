import type { AgentSessionSnapshot, Project, RunBackgroundTask, Workspace } from "../../../entities";
import type { AgentRuntimeProvider } from "../../../shared";
import {
  insertAutomationRun,
  markAutomationRunSchedule,
  updateAutomationRun,
  updateAutomationRunDivergence,
  type Automation,
  type AutomationRunTriggerSource,
} from "../../../entities/automation";
import { loadProjectSettings } from "../../../entities/project";
import {
  createDivergenceRepository,
  insertDivergenceRecord,
} from "../../create-divergence";
import {
  buildAutomationBranchName,
  buildAutomationPromptMarkdown,
  computeNextScheduledRunAtMs,
} from "../lib/automationScheduler.pure";

const DEFAULT_POLL_INTERVAL_MS = 5_000;
const DEFAULT_MAX_POLL_DURATION_MS = 4 * 60 * 60 * 1000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildWorkspaceKey(
  type: "project" | "divergence" | "workspace" | "workspace_divergence",
  targetId: number
): string {
  return `${type}:${targetId}`;
}

interface AutomationSessionDetails {
  runtime: "agent";
  agentSessionId: string;
  provider: AgentRuntimeProvider;
}

function encodeAutomationSessionDetails(details: AutomationSessionDetails): string {
  return JSON.stringify(details);
}

function getAutomationOutputTail(session: AgentSessionSnapshot): string {
  const assistantMessage = [...session.messages]
    .reverse()
    .find((message) => message.role === "assistant" && message.content.trim().length > 0);
  if (assistantMessage) {
    return assistantMessage.content;
  }

  const latestActivity = [...session.activities]
    .reverse()
    .find((activity) => activity.details?.trim());
  return latestActivity?.details ?? "";
}

export interface RunAutomationNowInput {
  automation: Automation;
  project: Pick<Project, "id" | "name" | "path"> | null;
  workspace?: Pick<Workspace, "id" | "name" | "folderPath"> | null;
  runTask: RunBackgroundTask;
  createAgentSession: (input: {
    provider: AgentRuntimeProvider;
    targetType: "project" | "divergence" | "workspace" | "workspace_divergence";
    targetId: number;
    projectId: number;
    workspaceOwnerId?: number;
    workspaceKey: string;
    sessionRole?: "default" | "review-agent" | "manual";
    name: string;
    path: string;
  }) => Promise<AgentSessionSnapshot>;
  startAgentTurn: (
    sessionId: string,
    prompt: string,
    options?: { automationMode?: boolean }
  ) => Promise<void>;
  getAgentSession: (sessionId: string) => Promise<AgentSessionSnapshot | null>;
  triggerSource?: AutomationRunTriggerSource;
  triggerContext?: {
    sourceRepoKey: string;
    targetProjectName: string;
    targetProjectPath: string;
    pullRequestNumber: number;
    pullRequestUrl: string;
    baseRef: string;
    headRef: string;
    mergeCommitSha: string;
    mergedAtMs: number;
  };
}

export interface RunAutomationNowResult {
  runId: number;
  status: "launched" | "error";
  agentSessionId?: string;
  divergenceId?: number;
  error?: string;
}

export interface RunAutomationNowDependencies {
  insertAutomationRun: typeof insertAutomationRun;
  updateAutomationRun: typeof updateAutomationRun;
  updateAutomationRunDivergence: typeof updateAutomationRunDivergence;
  markAutomationRunSchedule: typeof markAutomationRunSchedule;
  loadProjectSettings: typeof loadProjectSettings;
  createDivergenceRepository: typeof createDivergenceRepository;
  insertDivergenceRecord: typeof insertDivergenceRecord;
  buildAutomationPromptMarkdown: typeof buildAutomationPromptMarkdown;
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
    updateAutomationRunDivergence,
    markAutomationRunSchedule,
    loadProjectSettings,
    createDivergenceRepository,
    insertDivergenceRecord,
    buildAutomationPromptMarkdown,
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

  let divergencePath: string;
  let divergenceId = 0;

  if (input.workspace) {
    divergencePath = input.workspace.folderPath;
  } else {
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
    } catch (error) {
      const endedAtMs = deps.now();
      const errorMessage = `Failed to create divergence: ${error instanceof Error ? error.message : String(error)}`;
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
  }

  const agentTarget = input.workspace
    ? {
        targetType: "workspace" as const,
        targetId: input.workspace.id,
        workspaceOwnerId: input.workspace.id,
        workspaceKey: buildWorkspaceKey("workspace", input.workspace.id),
      }
    : divergenceId > 0
      ? {
          targetType: "divergence" as const,
          targetId: divergenceId,
          workspaceOwnerId: undefined,
          workspaceKey: buildWorkspaceKey("divergence", divergenceId),
        }
      : {
          targetType: "project" as const,
          targetId: project.id,
          workspaceOwnerId: undefined,
          workspaceKey: buildWorkspaceKey("project", project.id),
        };

  let agentSession: AgentSessionSnapshot;
  try {
    agentSession = await input.createAgentSession({
      provider: input.automation.agent,
      targetType: agentTarget.targetType,
      targetId: agentTarget.targetId,
      projectId: project.id,
      workspaceOwnerId: agentTarget.workspaceOwnerId,
      workspaceKey: agentTarget.workspaceKey,
      sessionRole: "manual",
      name: `Automation: ${input.automation.name}`,
      path: divergencePath,
    });
  } catch (error) {
    const endedAtMs = deps.now();
    const errorMessage = `Failed to create automation agent session: ${error instanceof Error ? error.message : String(error)}`;
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

  try {
    await input.runTask<void>({
      kind: "automation_run",
      title: `Automation: ${input.automation.name}`,
      target: {
        type: input.workspace ? "workspace" : "project",
        projectId: project.id,
        workspaceId: input.workspace?.id,
        divergenceId: divergenceId || undefined,
        projectName: project.name,
        path: divergencePath,
        label: `${project.name} / ${input.automation.name}`,
        agentSessionId: agentSession.id,
        agentProvider: input.automation.agent,
      },
      origin: "automation_manual",
      fsHeavy: false,
      initialPhase: "Queued",
      successMessage: `Automation completed: ${input.automation.name}`,
      errorMessage: `Automation failed: ${input.automation.name}`,
      dbRunId: runId,
      run: async ({ setPhase, setOutputTail }) => {
        setPhase("Preparing prompt");
        const markdown = deps.buildAutomationPromptMarkdown({
          automationName: input.automation.name,
          projectName: project.name,
          triggerSource,
          prompt: input.automation.prompt,
          generatedAtMs: deps.now(),
          triggerContext: input.triggerContext,
        });

        await deps.updateAutomationRun(runId, {
          status: "running",
          startedAtMs,
          detailsJson: encodeAutomationSessionDetails({
            runtime: "agent",
            agentSessionId: agentSession.id,
            provider: input.automation.agent,
          }),
        });

        setPhase("Sending prompt");
        await input.startAgentTurn(agentSession.id, markdown, { automationMode: true });

        setPhase("Running agent");
        const completedSession = await pollAgentSessionUntilDone({
          sessionId: agentSession.id,
          getAgentSession: input.getAgentSession,
          setOutputTail,
          pollIntervalMs: deps.pollIntervalMs,
          maxPollDurationMs: deps.maxPollDurationMs,
          now: deps.now,
        });

        const endedAtMs = deps.now();
        await deps.markAutomationRunSchedule(input.automation.id, {
          lastRunAtMs: endedAtMs,
          nextRunAtMs: computeNextScheduledRunAtMs(input.automation, endedAtMs),
        });

        const finalOutputTail = getAutomationOutputTail(completedSession);
        if (finalOutputTail.trim()) {
          setOutputTail(finalOutputTail);
        }

        if (completedSession.runtimeStatus === "error") {
          const errorMessage = completedSession.errorMessage || "Automation agent run failed.";
          await deps.updateAutomationRun(runId, {
            status: "error",
            startedAtMs,
            endedAtMs,
            error: errorMessage,
            detailsJson: encodeAutomationSessionDetails({
              runtime: "agent",
              agentSessionId: agentSession.id,
              provider: input.automation.agent,
            }),
          });
          dbFinalized = true;
          throw new Error(errorMessage);
        }

        if (completedSession.runtimeStatus === "stopped") {
          const errorMessage = "Automation agent session was stopped before completion.";
          await deps.updateAutomationRun(runId, {
            status: "error",
            startedAtMs,
            endedAtMs,
            error: errorMessage,
            detailsJson: encodeAutomationSessionDetails({
              runtime: "agent",
              agentSessionId: agentSession.id,
              provider: input.automation.agent,
            }),
          });
          dbFinalized = true;
          throw new Error(errorMessage);
        }

        await deps.updateAutomationRun(runId, {
          status: "success",
          startedAtMs,
          endedAtMs,
          detailsJson: encodeAutomationSessionDetails({
            runtime: "agent",
            agentSessionId: agentSession.id,
            provider: input.automation.agent,
          }),
        });
        dbFinalized = true;
      },
    });

    return {
      runId,
      status: "launched",
      agentSessionId: agentSession.id,
      divergenceId: divergenceId || undefined,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (!dbFinalized) {
      const endedAtMs = deps.now();
      await Promise.all([
        deps.updateAutomationRun(runId, {
          status: "error",
          startedAtMs,
          endedAtMs,
          error: message,
          detailsJson: encodeAutomationSessionDetails({
            runtime: "agent",
            agentSessionId: agentSession.id,
            provider: input.automation.agent,
          }),
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
      agentSessionId: agentSession.id,
      error: message,
    };
  }
}

async function pollAgentSessionUntilDone(input: {
  sessionId: string;
  getAgentSession: (sessionId: string) => Promise<AgentSessionSnapshot | null>;
  setOutputTail: (tail: string) => void;
  pollIntervalMs: number;
  maxPollDurationMs: number;
  now: () => number;
}): Promise<AgentSessionSnapshot> {
  const startedAt = input.now();

  while (true) {
    if (input.now() - startedAt >= input.maxPollDurationMs) {
      throw new Error(
        `Automation polling timed out after ${Math.round(input.maxPollDurationMs / 60_000)} minutes.`,
      );
    }

    await sleep(input.pollIntervalMs);

    const session = await input.getAgentSession(input.sessionId);
    if (!session) {
      throw new Error("Automation agent session disappeared.");
    }

    const outputTail = getAutomationOutputTail(session);
    if (outputTail.trim()) {
      input.setOutputTail(outputTail);
    }

    if (session.pendingRequest) {
      throw new Error(`Automation requires interactive input: ${session.pendingRequest.title}`);
    }

    if (session.runtimeStatus === "error" || session.runtimeStatus === "stopped") {
      return session;
    }

    if (
      session.runtimeStatus === "idle"
      && session.messages.some((message) => message.role === "assistant")
    ) {
      return session;
    }
  }
}
