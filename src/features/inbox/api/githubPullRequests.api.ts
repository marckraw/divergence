import { invoke } from "@tauri-apps/api/core";
import type { GithubPullRequestEvent } from "../model/githubInbox.types";

export async function fetchGithubPullRequests(
  token: string,
  owner: string,
  repo: string
): Promise<GithubPullRequestEvent[]> {
  return invoke<GithubPullRequestEvent[]>("fetch_github_pull_requests", {
    token,
    owner,
    repo,
  });
}
