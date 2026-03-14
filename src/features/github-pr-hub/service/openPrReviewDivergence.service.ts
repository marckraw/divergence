import type { Dispatch, SetStateAction } from "react";
import {
  createAgentSessionLabel,
  type AgentProvider,
  type AgentSessionSnapshot,
  type Divergence,
  type RunBackgroundTask,
} from "../../../entities";
import { insertDivergenceAndGetId } from "../../../entities/divergence";
import { loadProjectSettings } from "../../../entities/project";
import {
  allocatePort,
  detectFrameworkForPath,
  ensureProxyForEntity,
  getAdapterById,
} from "../../../entities/port-management";
import {
  DEFAULT_AGENT_PROVIDER,
  getAgentRuntimeProviderDefaultModel,
  getAvailableAgentProviders,
  type AgentRuntimeCapabilities,
  type CreateAgentSessionInput,
} from "../../../shared";
import {
  prepareGithubPrConflictResolutionDivergence,
  prepareGithubPrReviewDivergence,
} from "../api/githubPrHub.api";
import type {
  GithubPullRequestDetail,
  GithubPullRequestSummary,
} from "../model/githubPrHub.types";

type GithubPrDivergenceMode = "review" | "conflict-resolution";

interface OpenPrDivergenceParams {
  pullRequest: GithubPullRequestSummary;
  detail: GithubPullRequestDetail;
  githubToken: string;
  runTask: RunBackgroundTask;
  refreshDivergences: () => Promise<void>;
  refreshPortAllocations: () => Promise<void>;
  onSelectDivergence: (divergence: Divergence) => void;
  setActiveSessionId: Dispatch<SetStateAction<string | null>>;
  createAgentSession: (input: CreateAgentSessionInput) => Promise<AgentSessionSnapshot>;
  startAgentTurn: (sessionId: string, prompt: string) => Promise<void>;
  agentRuntimeCapabilities: AgentRuntimeCapabilities | null;
}

function buildDependencySetupInstructions(): string[] {
  return [
    "This divergence is a fresh project copy without node_modules or build artifacts.",
    "Before running tests, builds, or app commands, install dependencies in the repo with the correct package manager.",
  ];
}

function buildReviewPrompt(
  pullRequest: GithubPullRequestSummary,
  detail: GithubPullRequestDetail,
  divergencePath: string,
): string {
  return [
    `Review pull request #${pullRequest.number}: ${pullRequest.title}`,
    `Repository: ${pullRequest.repoKey}`,
    `Local checkout: ${divergencePath}`,
    `Base <- Head: ${detail.baseRef} <- ${detail.headRef}`,
    `Commits: ${detail.commits}`,
    `Changed files: ${detail.changedFiles}`,
    `Additions/Deletions: +${detail.additions} / -${detail.deletions}`,
    "",
    ...buildDependencySetupInstructions(),
    "Focus on correctness, regressions, edge cases, and missing tests.",
    "Summarize findings first, with the highest-risk issues first.",
  ].join("\n");
}

function buildConflictResolutionPrompt(
  pullRequest: GithubPullRequestSummary,
  detail: GithubPullRequestDetail,
  divergencePath: string,
): string {
  return [
    `Resolve merge conflicts for pull request #${pullRequest.number}: ${pullRequest.title}`,
    `Repository: ${pullRequest.repoKey}`,
    `Local checkout: ${divergencePath}`,
    `Base <- Head: ${detail.baseRef} <- ${detail.headRef}`,
    "",
    "The PR base branch has already been merged into this checkout and any conflicts are materialized locally.",
    ...buildDependencySetupInstructions(),
    "Resolve conflicts carefully, preserve the intended behavior from both branches, and keep the final diff reviewable.",
    "Run any focused validation needed after resolving conflicts, then summarize what changed and any remaining risks.",
  ].join("\n");
}

function getReviewProvider(capabilities: AgentRuntimeCapabilities | null): AgentProvider | null {
  const availableProviders = getAvailableAgentProviders(capabilities);
  if (availableProviders.length > 0) {
    return availableProviders[0];
  }
  return capabilities ? DEFAULT_AGENT_PROVIDER : null;
}

function buildPrAgentPrompt(
  mode: GithubPrDivergenceMode,
  pullRequest: GithubPullRequestSummary,
  detail: GithubPullRequestDetail,
  divergencePath: string,
): string {
  if (mode === "conflict-resolution") {
    return buildConflictResolutionPrompt(pullRequest, detail, divergencePath);
  }
  return buildReviewPrompt(pullRequest, detail, divergencePath);
}

function buildPrAgentSessionName(
  mode: GithubPrDivergenceMode,
  pullRequest: GithubPullRequestSummary,
  provider: AgentProvider,
): string {
  const sourceLabel = mode === "conflict-resolution"
    ? `PR #${pullRequest.number} conflicts`
    : `PR #${pullRequest.number}`;
  return createAgentSessionLabel(sourceLabel, provider, "review-agent");
}

function getTaskCopy(mode: GithubPrDivergenceMode, pullRequest: GithubPullRequestSummary) {
  if (mode === "conflict-resolution") {
    return {
      title: `Prepare conflict resolution divergence: ${pullRequest.repoKey} #${pullRequest.number}`,
      successMessage: `Prepared conflict resolution divergence for ${pullRequest.repoKey} #${pullRequest.number}`,
      errorMessage: `Failed to prepare conflict resolution divergence for ${pullRequest.repoKey} #${pullRequest.number}`,
      branchLabel: `${pullRequest.headRef} <- ${pullRequest.baseRef}`,
      preparePhase: "Preparing conflict resolution checkout",
      sessionPhase: "Opening conflict resolution session",
    };
  }

  return {
    title: `Open review divergence: ${pullRequest.repoKey} #${pullRequest.number}`,
    successMessage: `Opened review divergence for ${pullRequest.repoKey} #${pullRequest.number}`,
    errorMessage: `Failed to open review divergence for ${pullRequest.repoKey} #${pullRequest.number}`,
    branchLabel: pullRequest.headRef,
    preparePhase: "Preparing PR checkout",
    sessionPhase: "Opening review session",
  };
}

async function maybeOpenPrAgentSession({
  mode,
  divergence,
  pullRequest,
  detail,
  setActiveSessionId,
  createAgentSession,
  startAgentTurn,
  agentRuntimeCapabilities,
}: {
  mode: GithubPrDivergenceMode;
  divergence: Divergence;
  pullRequest: GithubPullRequestSummary;
  detail: GithubPullRequestDetail;
  setActiveSessionId: Dispatch<SetStateAction<string | null>>;
  createAgentSession: (input: CreateAgentSessionInput) => Promise<AgentSessionSnapshot>;
  startAgentTurn: (sessionId: string, prompt: string) => Promise<void>;
  agentRuntimeCapabilities: AgentRuntimeCapabilities | null;
}): Promise<void> {
  const provider = getReviewProvider(agentRuntimeCapabilities);
  if (!provider) {
    return;
  }

  try {
    const session = await createAgentSession({
      provider,
      targetType: "divergence",
      targetId: divergence.id,
      projectId: divergence.projectId,
      workspaceKey: `divergence:${divergence.id}`,
      sessionRole: "review-agent",
      nameMode: "manual",
      model: getAgentRuntimeProviderDefaultModel(agentRuntimeCapabilities, provider) ?? undefined,
      name: buildPrAgentSessionName(mode, pullRequest, provider),
      path: divergence.path,
    });
    setActiveSessionId(session.id);
    await startAgentTurn(
      session.id,
      buildPrAgentPrompt(mode, pullRequest, detail, divergence.path),
    );
  } catch (error) {
    console.warn(
      `Failed to create ${mode === "conflict-resolution" ? "conflict resolution" : "PR review"} agent session:`,
      error,
    );
  }
}

async function openPrDivergence({
  mode,
  pullRequest,
  detail,
  githubToken,
  runTask,
  refreshDivergences,
  refreshPortAllocations,
  onSelectDivergence,
  setActiveSessionId,
  createAgentSession,
  startAgentTurn,
  agentRuntimeCapabilities,
}: OpenPrDivergenceParams & { mode: GithubPrDivergenceMode }): Promise<Divergence> {
  const taskCopy = getTaskCopy(mode, pullRequest);

  return runTask<Divergence>({
    kind: "create_divergence",
    title: taskCopy.title,
    target: {
      type: "divergence",
      projectId: pullRequest.projectId,
      projectName: pullRequest.projectName,
      branch: taskCopy.branchLabel,
      path: pullRequest.projectPath,
      label: `${pullRequest.repoKey} #${pullRequest.number}`,
    },
    origin: "github_pr_hub",
    fsHeavy: true,
    initialPhase: "Queued",
    successMessage: taskCopy.successMessage,
    errorMessage: taskCopy.errorMessage,
    run: async ({ setPhase }) => {
      setPhase("Loading project settings");
      const settings = await loadProjectSettings(pullRequest.projectId);

      setPhase(taskCopy.preparePhase);
      const prepared = mode === "conflict-resolution"
        ? await prepareGithubPrConflictResolutionDivergence({
          token: githubToken,
          projectId: pullRequest.projectId,
          projectName: pullRequest.projectName,
          projectPath: pullRequest.projectPath,
          pullRequestOwner: pullRequest.owner,
          pullRequestRepo: pullRequest.repo,
          pullRequestNumber: pullRequest.number,
          copyIgnoredSkip: settings.copyIgnoredSkip,
        })
        : await prepareGithubPrReviewDivergence({
          token: githubToken,
          projectId: pullRequest.projectId,
          projectName: pullRequest.projectName,
          projectPath: pullRequest.projectPath,
          pullRequestOwner: pullRequest.owner,
          pullRequestRepo: pullRequest.repo,
          pullRequestNumber: pullRequest.number,
          copyIgnoredSkip: settings.copyIgnoredSkip,
        });

      setPhase("Saving divergence record");
      const insertedId = await insertDivergenceAndGetId({
        projectId: prepared.projectId,
        name: prepared.name,
        branch: prepared.branch,
        path: prepared.path,
        createdAt: prepared.createdAt,
        hasDiverged: prepared.hasDiverged,
      });
      const divergence: Divergence = {
        ...prepared,
        id: insertedId,
      };

      setPhase("Allocating port");
      try {
        const detectedFramework = settings.framework
          ? getAdapterById(settings.framework)
          : await detectFrameworkForPath(divergence.path);
        const preferredPort = settings.defaultPort ?? detectedFramework?.defaultPort;
        const allocation = await allocatePort({
          entityType: "divergence",
          entityId: insertedId,
          projectId: pullRequest.projectId,
          framework: detectedFramework?.id ?? null,
          preferredPort,
        });
        await ensureProxyForEntity({
          entityType: "divergence",
          entityId: insertedId,
          scopeName: pullRequest.projectName,
          branchName: divergence.branch,
          targetPort: allocation.port,
        });
        refreshPortAllocations();
      } catch (error) {
        console.warn("Port allocation failed for PR review divergence (non-fatal):", error);
      }

      setPhase("Refreshing divergences");
      await refreshDivergences();
      onSelectDivergence(divergence);

      setPhase(taskCopy.sessionPhase);
      await maybeOpenPrAgentSession({
        mode,
        divergence,
        pullRequest,
        detail,
        setActiveSessionId,
        createAgentSession,
        startAgentTurn,
        agentRuntimeCapabilities,
      });

      return divergence;
    },
  });
}

export async function openPrReviewDivergence(
  params: OpenPrDivergenceParams,
): Promise<Divergence> {
  return openPrDivergence({
    ...params,
    mode: "review",
  });
}

export async function openPrConflictResolutionDivergence(
  params: OpenPrDivergenceParams,
): Promise<Divergence> {
  return openPrDivergence({
    ...params,
    mode: "conflict-resolution",
  });
}
