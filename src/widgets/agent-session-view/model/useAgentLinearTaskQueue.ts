import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AgentSessionSnapshot, Project, WorkspaceMember } from "../../../entities";
import type { AgentSidebarTab } from "../ui/AgentSessionView.types";
import {
  buildLinearIssuePrompt,
  enrichLinearIssuesWithProject,
  filterLinearTaskQueueIssues,
  formatLinearLoadFailureDetails,
  mergeLinearTaskQueueIssues,
  resolveLinearIssueProjects,
  type LinearIssueStatusFilter,
  type LinearTaskQueueIssue,
} from "../../../features/linear-task-queue";
import {
  fetchLinearProjectIssues,
  fetchLinearWorkflowStates,
  getProjectLinearRef,
  getErrorMessage,
  updateLinearIssueState,
  type LinearWorkflowState,
} from "../../../shared";

interface UseAgentLinearTaskQueueParams {
  session: AgentSessionSnapshot | null;
  appSettings: {
    linearApiToken?: string | null;
  };
  projects: Project[];
  workspaceMembersByWorkspaceId: Map<number, WorkspaceMember[]>;
  sidebarTab: AgentSidebarTab;
  onSetComposerText: (text: string) => void;
}

export function useAgentLinearTaskQueue({
  session,
  appSettings,
  projects,
  workspaceMembersByWorkspaceId,
  sidebarTab,
  onSetComposerText,
}: UseAgentLinearTaskQueueParams) {
  const [linearProjectName, setLinearProjectName] = useState<string | null>(null);
  const [linearIssues, setLinearIssues] = useState<LinearTaskQueueIssue[]>([]);
  const [linearLoading, setLinearLoading] = useState(false);
  const [linearRefreshing, setLinearRefreshing] = useState(false);
  const [linearError, setLinearError] = useState<string | null>(null);
  const [linearInfoMessage, setLinearInfoMessage] = useState<string | null>(null);
  const [linearSendingIssueId, setLinearSendingIssueId] = useState<string | null>(null);
  const [linearStatusFilter, setLinearStatusFilter] = useState<LinearIssueStatusFilter>("open");
  const [linearSearchQuery, setLinearSearchQuery] = useState("");
  const [linearWorkflowStates, setLinearWorkflowStates] = useState<LinearWorkflowState[]>([]);
  const [linearUpdatingIssueId, setLinearUpdatingIssueId] = useState<string | null>(null);
  const [linearStatePickerOpenIssueId, setLinearStatePickerOpenIssueId] = useState<string | null>(null);
  const lastAutoLoadedLinearContextKeyRef = useRef<string | null>(null);
  const linearContextKeyRef = useRef<string | null>(null);

  const linearSessionContext = useMemo(() => {
    if (!session) {
      return null;
    }

    return {
      type: session.targetType,
      projectId: session.projectId,
      targetId: session.targetId,
      workspaceOwnerId: session.workspaceOwnerId,
    };
  }, [session]);

  const linearContextKey = useMemo(() => {
    if (!session || !linearSessionContext) {
      return null;
    }

    return [
      session.id,
      linearSessionContext.type,
      linearSessionContext.projectId,
      linearSessionContext.targetId,
      linearSessionContext.workspaceOwnerId ?? "none",
    ].join(":");
  }, [session, linearSessionContext]);

  const visibleLinearIssues = useMemo(() => (
    filterLinearTaskQueueIssues(linearIssues, linearStatusFilter, linearSearchQuery)
  ), [linearIssues, linearSearchQuery, linearStatusFilter]);

  useEffect(() => {
    linearContextKeyRef.current = linearContextKey;
  }, [linearContextKey]);

  const handleLoadLinearIssues = useCallback(async (refresh = false): Promise<boolean> => {
    const requestContextKey = linearContextKeyRef.current;

    if (!linearSessionContext || !requestContextKey) {
      setLinearProjectName(null);
      setLinearIssues([]);
      setLinearError(null);
      setLinearInfoMessage("Open a project, divergence, or workspace session to load Linear tasks.");
      return false;
    }

    const token = appSettings.linearApiToken?.trim() ?? "";
    if (!token) {
      setLinearProjectName(null);
      setLinearIssues([]);
      setLinearError(null);
      setLinearInfoMessage("Add a Linear API token in Settings > Integrations to load tasks.");
      return false;
    }

    const isWorkspaceSession = linearSessionContext.type === "workspace"
      || linearSessionContext.type === "workspace_divergence";
    const candidateProjects = resolveLinearIssueProjects(
      linearSessionContext,
      projects,
      workspaceMembersByWorkspaceId,
    );

    if (candidateProjects.length === 0) {
      setLinearProjectName(null);
      setLinearIssues([]);
      setLinearError(null);
      setLinearInfoMessage(
        isWorkspaceSession
          ? "This workspace has no member projects to load from."
          : "Unable to resolve the active project for this session.",
      );
      return false;
    }

    if (refresh) {
      setLinearRefreshing(true);
    } else {
      setLinearLoading(true);
    }

    try {
      const settledResults = await Promise.allSettled(
        candidateProjects.map(async (project) => {
          const projectRef = await getProjectLinearRef(project.path);
          if (!projectRef?.projectId) {
            return {
              kind: "skipped" as const,
              project,
            };
          }

          const issues = await fetchLinearProjectIssues(token, projectRef.projectId);
          return {
            kind: "success" as const,
            project,
            projectRef,
            issues,
          };
        }),
      );

      const successfulLoads: Array<{
        project: (typeof candidateProjects)[number];
        projectRef: { projectId: string; projectName: string | null; teamId: string | null };
        issues: Awaited<ReturnType<typeof fetchLinearProjectIssues>>;
      }> = [];
      const skippedProjects: Array<(typeof candidateProjects)[number]> = [];
      const failedProjects: Array<{ projectName: string; message: string }> = [];

      for (const [index, result] of settledResults.entries()) {
        const project = candidateProjects[index];
        if (!project) {
          continue;
        }

        if (result.status === "rejected") {
          failedProjects.push({
            projectName: project.name,
            message: getErrorMessage(result.reason, "Failed to fetch Linear issues."),
          });
          continue;
        }

        if (result.value.kind === "skipped") {
          skippedProjects.push(project);
          continue;
        }

        successfulLoads.push(result.value);
      }

      const mergedIssues = mergeLinearTaskQueueIssues(
        successfulLoads.map((load) => enrichLinearIssuesWithProject(load.issues, load.project)),
      );
      if (linearContextKeyRef.current !== requestContextKey) {
        return true;
      }

      setLinearIssues(mergedIssues);

      const firstTeamId = successfulLoads
        .map((load) => load.projectRef.teamId)
        .find((id): id is string => Boolean(id?.trim()));

      if (firstTeamId) {
        try {
          const states = await fetchLinearWorkflowStates(token, firstTeamId);
          if (linearContextKeyRef.current === requestContextKey) {
            setLinearWorkflowStates(states);
          }
        } catch {
          if (linearContextKeyRef.current === requestContextKey) {
            setLinearWorkflowStates([]);
          }
        }
      } else {
        setLinearWorkflowStates([]);
      }

      if (isWorkspaceSession) {
        const loadedCount = successfulLoads.length;
        setLinearProjectName(
          loadedCount === candidateProjects.length
            ? `Workspace (${loadedCount} projects)`
            : `Workspace (${loadedCount}/${candidateProjects.length} projects loaded)`,
        );
      } else {
        const firstLoad = successfulLoads[0];
        setLinearProjectName(
          firstLoad?.projectRef.projectName
          ?? firstLoad?.project.name
          ?? null,
        );
      }

      let nextError: string | null = null;
      let nextInfoMessage: string | null = null;

      if (successfulLoads.length === 0) {
        if (skippedProjects.length === candidateProjects.length) {
          nextInfoMessage = isWorkspaceSession
            ? "No Linear project mappings were found in .ralphy/config.json for workspace member projects."
            : "No Linear project mapping found in .ralphy/config.json for this project.";
        } else if (failedProjects.length > 0) {
          nextError = `Failed to load Linear tasks. ${formatLinearLoadFailureDetails(failedProjects)}`;
          if (skippedProjects.length > 0) {
            nextInfoMessage = `Skipped ${skippedProjects.length} project${
              skippedProjects.length === 1 ? "" : "s"
            } without Linear mapping.`;
          }
        }
      } else {
        const messageParts: string[] = [];
        if (mergedIssues.length === 0) {
          messageParts.push(
            isWorkspaceSession
              ? "No issues found across mapped workspace projects."
              : "No issues found in this Linear project.",
          );
        }
        if (skippedProjects.length > 0) {
          messageParts.push(
            `Skipped ${skippedProjects.length} project${
              skippedProjects.length === 1 ? "" : "s"
            } without Linear mapping.`,
          );
        }
        if (failedProjects.length > 0) {
          messageParts.push(
            `Failed to load ${failedProjects.length} project${
              failedProjects.length === 1 ? "" : "s"
            }: ${formatLinearLoadFailureDetails(failedProjects)}`,
          );
        }
        nextInfoMessage = messageParts.length > 0 ? messageParts.join(" ") : null;
      }

      setLinearError(nextError);
      setLinearInfoMessage(nextInfoMessage);
      return true;
    } catch (error) {
      if (linearContextKeyRef.current !== requestContextKey) {
        return true;
      }
      setLinearError(getErrorMessage(error, "Failed to load Linear tasks."));
      setLinearInfoMessage(null);
      return true;
    } finally {
      if (linearContextKeyRef.current === requestContextKey) {
        if (refresh) {
          setLinearRefreshing(false);
        } else {
          setLinearLoading(false);
        }
      }
    }
  }, [appSettings.linearApiToken, linearSessionContext, projects, workspaceMembersByWorkspaceId]);

  useEffect(() => {
    if (sidebarTab !== "linear" || !linearContextKey) {
      return;
    }

    if (lastAutoLoadedLinearContextKeyRef.current === linearContextKey) {
      return;
    }

    let cancelled = false;

    const loadLinearIssues = async () => {
      const attempted = await handleLoadLinearIssues(false);
      if (!cancelled && attempted) {
        lastAutoLoadedLinearContextKeyRef.current = linearContextKey;
      }
    };

    void loadLinearIssues();
    return () => {
      cancelled = true;
    };
  }, [handleLoadLinearIssues, linearContextKey, sidebarTab]);

  const handleLinearRefresh = useCallback(async () => {
    const attempted = await handleLoadLinearIssues(true);
    if (attempted && linearContextKey) {
      lastAutoLoadedLinearContextKeyRef.current = linearContextKey;
    }
  }, [handleLoadLinearIssues, linearContextKey]);

  const handleLinearSendIssue = useCallback(async (issueId: string) => {
    const issue = linearIssues.find((current) => current.id === issueId);
    if (!issue) {
      return;
    }

    setLinearSendingIssueId(issueId);
    try {
      onSetComposerText(buildLinearIssuePrompt(issue));
      setLinearError(null);
    } finally {
      setLinearSendingIssueId((prev) => (prev === issueId ? null : prev));
    }
  }, [linearIssues, onSetComposerText]);

  const handleLinearUpdateIssueState = useCallback(async (issueId: string, stateId: string) => {
    const token = appSettings.linearApiToken?.trim() ?? "";
    if (!token) {
      setLinearError("Linear API token is required to update issue state.");
      return;
    }

    setLinearUpdatingIssueId(issueId);
    try {
      const result = await updateLinearIssueState(token, issueId, stateId);
      if (result.success) {
        setLinearIssues((prev) => prev.map((issue) => {
          if (issue.id !== issueId) {
            return issue;
          }
          return {
            ...issue,
            stateName: result.stateName ?? issue.stateName,
            stateType: result.stateType ?? issue.stateType,
          };
        }));
        setLinearError(null);
      } else {
        setLinearError("Linear API reported the state update was not successful.");
      }
    } catch (error) {
      setLinearError(getErrorMessage(error, "Failed to update issue state."));
    } finally {
      setLinearUpdatingIssueId((prev) => (prev === issueId ? null : prev));
    }
  }, [appSettings.linearApiToken]);

  const resetLinearState = useCallback(() => {
    setLinearProjectName(null);
    setLinearIssues([]);
    setLinearLoading(false);
    setLinearRefreshing(false);
    setLinearError(null);
    setLinearInfoMessage(null);
    setLinearSendingIssueId(null);
    setLinearWorkflowStates([]);
    setLinearUpdatingIssueId(null);
    setLinearStatePickerOpenIssueId(null);
  }, []);

  return {
    linearProjectName,
    linearIssues,
    linearTotalIssueCount: linearIssues.length,
    visibleLinearIssues,
    linearLoading,
    linearRefreshing,
    linearError,
    linearInfoMessage,
    linearSendingIssueId,
    linearStatusFilter,
    linearSearchQuery,
    linearWorkflowStates,
    linearUpdatingIssueId,
    linearStatePickerOpenIssueId,
    setLinearStatusFilter,
    setLinearSearchQuery,
    setLinearStatePickerOpenIssueId,
    handleLinearRefresh,
    handleLinearSendIssue,
    handleLinearUpdateIssueState,
    resetLinearState,
  };
}
