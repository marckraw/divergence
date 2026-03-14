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
import { prepareGithubPrReviewDivergence } from "../api/githubPrHub.api";
import type {
  GithubPullRequestDetail,
  GithubPullRequestSummary,
} from "../model/githubPrHub.types";

interface OpenPrReviewDivergenceParams {
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
    "Focus on correctness, regressions, edge cases, and missing tests.",
    "Summarize findings first, with the highest-risk issues first.",
  ].join("\n");
}

function getReviewProvider(capabilities: AgentRuntimeCapabilities | null): AgentProvider | null {
  const availableProviders = getAvailableAgentProviders(capabilities);
  if (availableProviders.length > 0) {
    return availableProviders[0];
  }
  return capabilities ? DEFAULT_AGENT_PROVIDER : null;
}

async function maybeOpenReviewAgentSession({
  divergence,
  pullRequest,
  detail,
  setActiveSessionId,
  createAgentSession,
  startAgentTurn,
  agentRuntimeCapabilities,
}: {
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
      name: createAgentSessionLabel(`PR #${pullRequest.number}`, provider, "review-agent"),
      path: divergence.path,
    });
    setActiveSessionId(session.id);
    await startAgentTurn(session.id, buildReviewPrompt(pullRequest, detail, divergence.path));
  } catch (error) {
    console.warn("Failed to create PR review agent session:", error);
  }
}

export async function openPrReviewDivergence({
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
}: OpenPrReviewDivergenceParams): Promise<Divergence> {
  return runTask<Divergence>({
    kind: "create_divergence",
    title: `Open review divergence: ${pullRequest.repoKey} #${pullRequest.number}`,
    target: {
      type: "divergence",
      projectId: pullRequest.projectId,
      projectName: pullRequest.projectName,
      branch: detail.headRef,
      path: pullRequest.projectPath,
      label: `${pullRequest.repoKey} #${pullRequest.number}`,
    },
    origin: "github_pr_hub",
    fsHeavy: true,
    initialPhase: "Queued",
    successMessage: `Opened review divergence for ${pullRequest.repoKey} #${pullRequest.number}`,
    errorMessage: `Failed to open review divergence for ${pullRequest.repoKey} #${pullRequest.number}`,
    run: async ({ setPhase }) => {
      setPhase("Loading project settings");
      const settings = await loadProjectSettings(pullRequest.projectId);

      setPhase("Preparing PR checkout");
      const prepared = await prepareGithubPrReviewDivergence({
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

      setPhase("Opening review session");
      await maybeOpenReviewAgentSession({
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
