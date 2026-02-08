import type {
  GithubPullRequestEvent,
  GithubRepoTarget,
} from "../model/githubPullRequests.types";

export type GithubPullRequestInboxKind = "github_pr_opened" | "github_pr_updated";

export function buildGithubRepoKey(owner: string, repo: string): string {
  return `${owner.trim().toLowerCase()}/${repo.trim().toLowerCase()}`;
}

export function buildGithubRepoTarget(input: {
  projectId: number;
  projectName: string;
  owner: string;
  repo: string;
}): GithubRepoTarget {
  return {
    projectId: input.projectId,
    projectName: input.projectName,
    owner: input.owner,
    repo: input.repo,
    repoKey: buildGithubRepoKey(input.owner, input.repo),
  };
}

export function classifyGithubPullRequestEvent(
  pullRequest: GithubPullRequestEvent,
  lastPolledAtMs: number
): GithubPullRequestInboxKind | null {
  if (pullRequest.createdAtMs > lastPolledAtMs) {
    return "github_pr_opened";
  }

  if (pullRequest.updatedAtMs > lastPolledAtMs && pullRequest.updatedAtMs > pullRequest.createdAtMs) {
    return "github_pr_updated";
  }

  return null;
}

export function buildGithubInboxExternalId(
  repoKey: string,
  pullRequestId: number,
  kind: GithubPullRequestInboxKind,
  eventAtMs: number
): string {
  return `github:${repoKey}:pr:${pullRequestId}:${kind}:${eventAtMs}`;
}

export function buildGithubInboxTitle(
  repoKey: string,
  pullRequestNumber: number,
  kind: GithubPullRequestInboxKind
): string {
  const verb = kind === "github_pr_opened" ? "opened" : "updated";
  return `${repoKey} PR #${pullRequestNumber} ${verb}`;
}

export function buildGithubInboxBody(pullRequest: GithubPullRequestEvent): string {
  const authorText = pullRequest.userLogin ? `Author: @${pullRequest.userLogin}` : "Author: unknown";
  return [
    pullRequest.title,
    authorText,
    pullRequest.htmlUrl,
  ].join("\n");
}

