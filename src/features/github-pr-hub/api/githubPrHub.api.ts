import { invoke } from "@tauri-apps/api/core";
import type {
  GithubPullRequestDetail,
  GithubPullRequestFile,
  GithubPullRequestMergeMethod,
  GithubPullRequestMergeResult,
  GithubPullRequestSummary,
} from "../model/githubPrHub.types";

export async function fetchGithubPullRequestsForRepo(
  token: string,
  owner: string,
  repo: string,
): Promise<GithubPullRequestSummary[]> {
  return invoke<GithubPullRequestSummary[]>("fetch_github_pull_requests", {
    token,
    owner,
    repo,
  });
}

export async function fetchGithubPullRequestDetail(
  token: string,
  owner: string,
  repo: string,
  number: number,
): Promise<GithubPullRequestDetail> {
  return invoke<GithubPullRequestDetail>("fetch_github_pull_request_detail", {
    token,
    owner,
    repo,
    number,
  });
}

export async function fetchGithubPullRequestFiles(
  token: string,
  owner: string,
  repo: string,
  number: number,
  page: number = 1,
  perPage: number = 100,
): Promise<GithubPullRequestFile[]> {
  return invoke<GithubPullRequestFile[]>("fetch_github_pull_request_files", {
    token,
    owner,
    repo,
    number,
    page,
    perPage,
  });
}

export async function mergeGithubPullRequest(
  token: string,
  owner: string,
  repo: string,
  number: number,
  method: GithubPullRequestMergeMethod,
  expectedHeadSha: string,
): Promise<GithubPullRequestMergeResult> {
  return invoke<GithubPullRequestMergeResult>("merge_github_pull_request", {
    token,
    owner,
    repo,
    number,
    method,
    expectedHeadSha,
  });
}

