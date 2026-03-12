import type { Divergence } from "../../../entities";

export type GithubPrChecksState = "success" | "pending" | "failure" | "unknown";

export type GithubPullRequestMergeMethod = "merge" | "squash";

export interface GithubPrProjectTarget {
  projectId: number;
  projectName: string;
  projectPath: string;
  owner: string;
  repo: string;
  repoKey: string;
}

export interface GithubPullRequestRemoteSummary {
  id: number;
  number: number;
  title: string;
  htmlUrl: string;
  userLogin: string | null;
  createdAtMs: number;
  updatedAtMs: number;
  baseRef: string;
  headRef: string;
  headSha: string;
  draft: boolean;
  mergeable: boolean | null;
  mergeableState: string | null;
}

export interface GithubPullRequestSummary extends GithubPullRequestRemoteSummary {
  projectId: number;
  projectName: string;
  projectPath: string;
  owner: string;
  repo: string;
  repoKey: string;
}

export interface GithubPullRequestDetail {
  id: number;
  number: number;
  title: string;
  body: string;
  state: string;
  htmlUrl: string;
  userLogin: string | null;
  createdAtMs: number;
  updatedAtMs: number;
  baseRef: string;
  headRef: string;
  headSha: string;
  draft: boolean;
  mergeable: boolean | null;
  mergeableState: string | null;
  additions: number;
  deletions: number;
  changedFiles: number;
  commits: number;
  checksState: string | null;
}

export interface GithubPullRequestFile {
  sha: string;
  filename: string;
  status: string;
  patch: string | null;
  previousFilename: string | null;
  additions: number;
  deletions: number;
  changes: number;
}

export interface GithubPullRequestMergeResult {
  merged: boolean;
  sha: string | null;
  message: string;
  method: string;
  mergedAtMs: number | null;
}

export type GithubPrReviewDivergenceResult = Divergence;
