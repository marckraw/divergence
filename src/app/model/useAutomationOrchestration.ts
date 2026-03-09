import { useState, useCallback, useEffect, useMemo } from "react";
import {
  runAutomationNow,
  reconcileAutomationRuns,
  useAutomationRunPoller,
  useAutomationScheduler,
  notifyAutomationCompletion,
} from "../../features/automations";
import {
  dispatchTriggeredAutomations,
  ensureAutomationWorkspace,
  matchGithubMergedTriggers,
  parseGithubTriggerBaseBranches,
  useCloudAutomationEventPoller,
} from "../../features/automation-triggers";
import type { AutomationRunTriggerSource } from "../../entities/automation";
import { insertInboxEvent } from "../../entities/inbox-event";
import {
  ackCloudAutomationEvent,
  type AgentRuntimeProvider,
  getProjectGithubRepository,
  nackCloudAutomationEvent,
  pullCloudAutomationEventQueueCounts,
  recordDebugEvent,
  type GithubPrMergedAutomationEvent,
} from "../../shared";
import type {
  AgentSessionSnapshot,
  Project,
  Workspace,
  Automation,
  AutomationRun,
  CreateAutomationInput,
  UpdateAutomationInput,
  RunBackgroundTask,
} from "../../entities";

const CLOUD_QUEUE_COUNTS_POLL_INTERVAL_MS = 30_000;

function formatDebugErrorDetails(error: unknown): string {
  if (error instanceof Error) {
    return error.stack?.trim() || `${error.name}: ${error.message}`;
  }

  if (typeof error === "string") {
    return error;
  }

  try {
    return JSON.stringify(error, null, 2);
  } catch {
    return String(error);
  }
}

interface UseAutomationOrchestrationParams {
  automations: Automation[];
  automationRuns: AutomationRun[];
  projects: Project[];
  appSettings: {
    cloudApiBaseUrl?: string;
    cloudApiToken?: string;
  };
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
  refreshAutomations: () => Promise<void>;
  refreshDivergences: () => Promise<void>;
  refreshWorkspaces: () => Promise<void>;
  refreshInbox: () => Promise<void>;
  refreshPortAllocations: () => Promise<void>;
  createAutomation: (input: CreateAutomationInput) => Promise<number>;
  saveAutomation: (input: UpdateAutomationInput) => Promise<void>;
  removeAutomation: (id: number) => Promise<void>;
  latestRunByAutomationId: Map<number, AutomationRun>;
}

interface UseAutomationOrchestrationResult {
  queuedCloudCountByAutomationId: Map<number, number>;
  handleRunAutomationNow: (automationId: number) => Promise<void>;
  handleCreateAutomation: (input: CreateAutomationInput) => Promise<void>;
  handleUpdateAutomation: (input: UpdateAutomationInput) => Promise<void>;
  handleDeleteAutomation: (automationId: number) => Promise<void>;
}

export function useAutomationOrchestration({
  automations,
  projects,
  appSettings,
  runTask,
  createAgentSession,
  startAgentTurn,
  getAgentSession,
  refreshAutomations,
  refreshDivergences,
  refreshWorkspaces,
  refreshInbox,
  createAutomation,
  saveAutomation,
  removeAutomation,
}: UseAutomationOrchestrationParams): UseAutomationOrchestrationResult {
  const [queuedCloudCountByAutomationId, setQueuedCloudCountByAutomationId] = useState<Map<number, number>>(new Map());

  const projectById = useMemo(() => {
    const map = new Map<number, Project>();
    projects.forEach((project) => map.set(project.id, project));
    return map;
  }, [projects]);

  // Automation run poller — monitors running tmux-based automation runs
  useAutomationRunPoller({
    onRunCompleted: useCallback((runId: number) => {
      recordDebugEvent({
        level: "info",
        category: "automation",
        message: "Automation run completed",
        metadata: { runId },
      });
      console.log(`Automation run ${runId} completed successfully.`);
      void refreshAutomations();
      void notifyAutomationCompletion({
        cloudApiBaseUrl: appSettings.cloudApiBaseUrl,
        cloudApiToken: appSettings.cloudApiToken,
        runId,
        status: "success",
      });
    }, [refreshAutomations, appSettings.cloudApiBaseUrl, appSettings.cloudApiToken]),
    onRunFailed: useCallback((runId: number, error: string) => {
      recordDebugEvent({
        level: "warn",
        category: "automation",
        message: "Automation run failed",
        details: error,
        metadata: { runId },
      });
      console.warn(`Automation run ${runId} failed: ${error}`);
      void refreshAutomations();
      void notifyAutomationCompletion({
        cloudApiBaseUrl: appSettings.cloudApiBaseUrl,
        cloudApiToken: appSettings.cloudApiToken,
        runId,
        status: "error",
        errorMessage: error,
      });
    }, [refreshAutomations, appSettings.cloudApiBaseUrl, appSettings.cloudApiToken]),
    onOutputUpdate: useCallback(() => {
      // Output updates are available but not displayed in this phase
    }, []),
  });

  // Reconcile automation runs on startup
  useEffect(() => {
    void reconcileAutomationRuns().then(() => {
      void refreshAutomations();
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const executeAutomationRun = useCallback(async (
    automationId: number,
    input?: {
      triggerSource?: AutomationRunTriggerSource;
      eventContext?: GithubPrMergedAutomationEvent;
    },
  ): Promise<number | null> => {
    const automation = automations.find((item) => item.id === automationId);
    if (!automation) {
      if (input?.triggerSource) return null;
      throw new Error("Automation not found.");
    }
    let project = projectById.get(automation.projectId) ?? null;
    let workspace: Workspace | null = null;
    let triggerContext: {
      sourceRepoKey: string;
      targetProjectName: string;
      targetProjectPath: string;
      pullRequestNumber: number;
      pullRequestUrl: string;
      baseRef: string;
      headRef: string;
      mergeCommitSha: string;
      mergedAtMs: number;
    } | undefined;

    if (automation.runMode === "event" && automation.sourceProjectId && automation.targetProjectId) {
      const sourceProject = projectById.get(automation.sourceProjectId) ?? null;
      const targetProject = projectById.get(automation.targetProjectId) ?? null;
      if (!sourceProject || !targetProject) {
        throw new Error("Source or target project for event automation was not found.");
      }

      workspace = await ensureAutomationWorkspace({
        sourceProject,
        targetProject,
        allProjectsById: projectById,
      });
      project = targetProject;
      await refreshWorkspaces();

      if (input?.eventContext) {
        triggerContext = {
          sourceRepoKey: input.eventContext.repoKey,
          targetProjectName: targetProject.name,
          targetProjectPath: targetProject.path,
          pullRequestNumber: input.eventContext.prNumber,
          pullRequestUrl: input.eventContext.htmlUrl,
          baseRef: input.eventContext.baseRef,
          headRef: input.eventContext.headRef,
          mergeCommitSha: input.eventContext.mergeCommitSha,
          mergedAtMs: input.eventContext.mergedAtMs,
        };
      }
    }

    const result = await runAutomationNow({
      automation,
      project,
      workspace,
      runTask,
      createAgentSession,
      startAgentTurn,
      getAgentSession,
      triggerSource: input?.triggerSource,
      triggerContext,
    });
    await Promise.all([refreshAutomations(), refreshDivergences()]);
    return result.status === "launched" ? result.runId : null;
  }, [
    automations,
    createAgentSession,
    getAgentSession,
    projectById,
    refreshAutomations,
    refreshDivergences,
    refreshWorkspaces,
    runTask,
    startAgentTurn,
  ]);

  // Cloud queue count polling
  useEffect(() => {
    const cloudApiBaseUrl = appSettings.cloudApiBaseUrl ?? "";
    const cloudApiToken = appSettings.cloudApiToken ?? "";
    if (!cloudApiBaseUrl.trim() || !cloudApiToken.trim()) {
      setQueuedCloudCountByAutomationId(new Map());
      return;
    }

    let cancelled = false;
    let inFlight = false;

    const refreshQueueCounts = async () => {
      if (inFlight || cancelled) {
        return;
      }
      inFlight = true;
      try {
        const queueCounts = await pullCloudAutomationEventQueueCounts({
          baseUrl: cloudApiBaseUrl,
          cloudApiToken,
        });
        const queueByRepoAndBase = new Map<string, number>();
        for (const item of queueCounts) {
          queueByRepoAndBase.set(`${item.repoKey}::${item.baseRef}`, item.queuedCount);
        }

        const eventAutomations = automations.filter(
          (automation) => automation.enabled && automation.runMode === "event" && Boolean(automation.sourceProjectId),
        );
        const sourceProjectIds = Array.from(new Set(
          eventAutomations
            .map((automation) => automation.sourceProjectId)
            .filter((value): value is number => typeof value === "number"),
        ));

        const sourceRepoKeyByProjectId = new Map<number, string | null>();
        await Promise.all(sourceProjectIds.map(async (projectId) => {
          const project = projectById.get(projectId);
          if (!project) {
            sourceRepoKeyByProjectId.set(projectId, null);
            return;
          }
          const repo = await getProjectGithubRepository(project.path);
          sourceRepoKeyByProjectId.set(projectId, repo?.repoKey ?? null);
        }));

        const nextCounts = new Map<number, number>();
        for (const automation of eventAutomations) {
          const sourceProjectId = automation.sourceProjectId;
          if (!sourceProjectId) {
            continue;
          }
          const sourceRepoKey = sourceRepoKeyByProjectId.get(sourceProjectId);
          if (!sourceRepoKey) {
            continue;
          }
          const baseBranches = parseGithubTriggerBaseBranches(automation.triggerConfigJson);
          if (baseBranches.length === 0) {
            continue;
          }
          let queuedCount = 0;
          for (const baseBranch of baseBranches) {
            queuedCount += queueByRepoAndBase.get(`${sourceRepoKey}::${baseBranch}`) ?? 0;
          }
          if (queuedCount > 0) {
            nextCounts.set(automation.id, queuedCount);
          }
        }

        if (!cancelled) {
          setQueuedCloudCountByAutomationId(nextCounts);
        }
      } catch (error) {
        if (!cancelled) {
          recordDebugEvent({
            level: "warn",
            category: "automation",
            message: "Failed to refresh cloud automation queue counts",
            details: formatDebugErrorDetails(error),
          });
        }
      } finally {
        inFlight = false;
      }
    };

    void refreshQueueCounts();
    const timerId = window.setInterval(() => {
      void refreshQueueCounts();
    }, CLOUD_QUEUE_COUNTS_POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(timerId);
    };
  }, [
    appSettings.cloudApiBaseUrl,
    appSettings.cloudApiToken,
    automations,
    projectById,
  ]);

  const handleRunAutomationNow = useCallback(
    async (automationId: number) => {
      await executeAutomationRun(automationId);
    },
    [executeAutomationRun],
  );

  const handleRunScheduledAutomation = useCallback(
    (automationId: number, triggerSource: AutomationRunTriggerSource) =>
      executeAutomationRun(automationId, { triggerSource }).then(() => undefined),
    [executeAutomationRun],
  );

  const handleCloudAutomationEvents = useCallback(async (
    events: GithubPrMergedAutomationEvent[],
  ): Promise<void> => {
    let shouldRefreshInbox = false;
    const enabledEventAutomationsCount = automations.filter(
      (automation) => automation.enabled && automation.runMode === "event",
    ).length;

    for (const event of events) {
      try {
        recordDebugEvent({
          level: "info",
          category: "automation",
          message: "Processing cloud automation event",
          metadata: {
            eventId: event.eventId,
            externalEventId: event.externalEventId,
            repoKey: event.repoKey,
            baseRef: event.baseRef,
          },
        });

        const insertedId = await insertInboxEvent({
          kind: "github_pr_merged",
          source: "github",
          externalId: event.externalEventId,
          title: `${event.repoKey} PR #${event.prNumber} merged into ${event.baseRef}`,
          body: [
            `PR #${event.prNumber}`,
            `Base: ${event.baseRef}`,
            `Head: ${event.headRef}`,
            event.htmlUrl,
          ].join("\n"),
          payloadJson: JSON.stringify(event),
          createdAtMs: event.mergedAtMs,
        });
        if (insertedId) {
          shouldRefreshInbox = true;
        }

        const matches = await matchGithubMergedTriggers({
          automations,
          projectsById: projectById,
          event,
        });

        if (matches.length === 0) {
          recordDebugEvent({
            level: "warn",
            category: "automation",
            message: "No event automation matched cloud event",
            metadata: {
              eventId: event.eventId,
              externalEventId: event.externalEventId,
              repoKey: event.repoKey,
              baseRef: event.baseRef,
              enabledEventAutomations: enabledEventAutomationsCount,
            },
          });
        } else {
          recordDebugEvent({
            level: "info",
            category: "automation",
            message: "Dispatching matched event automations",
            metadata: {
              eventId: event.eventId,
              matchedAutomations: matches.length,
            },
          });
        }

        await dispatchTriggeredAutomations({
          matches,
          externalEventId: event.externalEventId,
          launchAutomation: (automationId: number) =>
            executeAutomationRun(automationId, {
              triggerSource: "manual",
              eventContext: event,
            }),
        });

        await ackCloudAutomationEvent({
          baseUrl: appSettings.cloudApiBaseUrl ?? "",
          cloudApiToken: appSettings.cloudApiToken ?? "",
          eventId: event.eventId,
        });
      } catch (error) {
        recordDebugEvent({
          level: "warn",
          category: "automation",
          message: "Failed to process cloud automation event",
          details: error instanceof Error ? error.message : String(error),
          metadata: {
            eventId: event.eventId,
            externalEventId: event.externalEventId,
          },
        });
        try {
          await nackCloudAutomationEvent({
            baseUrl: appSettings.cloudApiBaseUrl ?? "",
            cloudApiToken: appSettings.cloudApiToken ?? "",
            eventId: event.eventId,
            reason: error instanceof Error ? error.message : String(error),
          });
        } catch (nackError) {
          console.warn(`Failed to nack cloud automation event ${event.eventId}:`, nackError);
        }
      }
    }
    if (shouldRefreshInbox) {
      await refreshInbox();
    }
  }, [
    appSettings.cloudApiBaseUrl,
    appSettings.cloudApiToken,
    automations,
    executeAutomationRun,
    projectById,
    refreshInbox,
  ]);

  const handleCloudAutomationPollError = useCallback((error: unknown): void => {
    const errorDetails = formatDebugErrorDetails(error);
    const errorName = error instanceof Error ? error.name : typeof error;

    recordDebugEvent({
      level: "warn",
      category: "automation",
      message: "Cloud automation event poll failed",
      details: errorDetails,
      metadata: {
        cloudApiBaseUrl: appSettings.cloudApiBaseUrl ?? "",
        errorType: errorName,
      },
    });
  }, [appSettings.cloudApiBaseUrl]);

  const handleCloudAutomationEventsPulled = useCallback((events: GithubPrMergedAutomationEvent[]): void => {
    if (events.length === 0) return;
    recordDebugEvent({
      level: "info",
      category: "automation",
      message: "Pulled cloud automation events",
      metadata: {
        count: events.length,
      },
    });
  }, []);

  useCloudAutomationEventPoller({
    enabled: Boolean((appSettings.cloudApiToken ?? "").trim() && (appSettings.cloudApiBaseUrl ?? "").trim()),
    cloudApiBaseUrl: appSettings.cloudApiBaseUrl ?? "",
    cloudApiToken: appSettings.cloudApiToken ?? "",
    onEvents: handleCloudAutomationEvents,
    onPollError: handleCloudAutomationPollError,
    onPulledEvents: handleCloudAutomationEventsPulled,
  });

  // Automation scheduler — periodically triggers due automations
  useAutomationScheduler({
    automations,
    projectById,
    onTriggerRun: handleRunScheduledAutomation,
  });

  const handleCreateAutomation = useCallback(async (input: CreateAutomationInput) => {
    await createAutomation(input);
    await refreshAutomations();
  }, [createAutomation, refreshAutomations]);

  const handleUpdateAutomation = useCallback(async (input: UpdateAutomationInput) => {
    await saveAutomation(input);
    await refreshAutomations();
  }, [refreshAutomations, saveAutomation]);

  const handleDeleteAutomation = useCallback(async (automationId: number) => {
    await removeAutomation(automationId);
    await refreshAutomations();
  }, [refreshAutomations, removeAutomation]);

  return {
    queuedCloudCountByAutomationId,
    handleRunAutomationNow,
    handleCreateAutomation,
    handleUpdateAutomation,
    handleDeleteAutomation,
  };
}
