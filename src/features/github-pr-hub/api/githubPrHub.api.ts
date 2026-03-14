import { invoke } from "@tauri-apps/api/core";
import type {
  GithubPrReviewDivergenceResult,
  GithubPullRequestDetail,
  GithubPullRequestFile,
  GithubPullRequestMergeMethod,
  GithubPullRequestMergeResult,
  GithubPullRequestRemoteSummary,
} from "../model/githubPrHub.types";
import {
  parseGithubPrReviewDivergenceResult,
  parseGithubPullRequestDetail,
  parseGithubPullRequestFiles,
  parseGithubPullRequestMergeResult,
  parseGithubPullRequestRemoteSummaries,
} from "./githubPrHub.schemas";

interface PrepareGithubPrDivergenceInput {
  token: string;
  projectId: number;
  projectName: string;
  projectPath: string;
  pullRequestOwner: string;
  pullRequestRepo: string;
  pullRequestNumber: number;
  copyIgnoredSkip: string[];
}

export async function fetchGithubPullRequestsForRepo(
  token: string,
  owner: string,
  repo: string,
): Promise<GithubPullRequestRemoteSummary[]> {
  return parseGithubPullRequestRemoteSummaries(await invoke<unknown>("fetch_github_pull_requests", {
    token,
    owner,
    repo,
  }));
}

export async function fetchGithubPullRequestDetail(
  token: string,
  owner: string,
  repo: string,
  number: number,
): Promise<GithubPullRequestDetail> {
  return parseGithubPullRequestDetail(await invoke<unknown>("fetch_github_pull_request_detail", {
    token,
    owner,
    repo,
    number,
  }));
}

export async function fetchGithubPullRequestFiles(
  token: string,
  owner: string,
  repo: string,
  number: number,
  page: number = 1,
  perPage: number = 100,
): Promise<GithubPullRequestFile[]> {
  return parseGithubPullRequestFiles(await invoke<unknown>("fetch_github_pull_request_files", {
    token,
    owner,
    repo,
    number,
    page,
    perPage,
  }));
}

export async function mergeGithubPullRequest(
  token: string,
  owner: string,
  repo: string,
  number: number,
  method: GithubPullRequestMergeMethod,
  expectedHeadSha: string,
): Promise<GithubPullRequestMergeResult> {
  return parseGithubPullRequestMergeResult(await invoke<unknown>("merge_github_pull_request", {
    token,
    owner,
    repo,
    number,
    method,
    expectedHeadSha,
  }));
}

export async function prepareGithubPrReviewDivergence(
  input: PrepareGithubPrDivergenceInput,
): Promise<GithubPrReviewDivergenceResult> {
  return parseGithubPrReviewDivergenceResult(await invoke<unknown>(
    "prepare_github_pr_review_divergence",
    { input: { ...input } },
  ));
}

export async function prepareGithubPrConflictResolutionDivergence(
  input: PrepareGithubPrDivergenceInput,
): Promise<GithubPrReviewDivergenceResult> {
  return parseGithubPrReviewDivergenceResult(await invoke<unknown>(
    "prepare_github_pr_conflict_resolution_divergence",
    { input: { ...input } },
  ));
}
