import { invoke } from "@tauri-apps/api/core";
import type { GithubPullRequestEvent } from "../model/githubPullRequests.types";

export async function fetchGithubPullRequests(
  owner: string,
  repo: string
): Promise<GithubPullRequestEvent[]> {
  return invoke<GithubPullRequestEvent[]>("fetch_github_pull_requests", {
    owner,
    repo,
  });
}
