export interface GithubPullRequestEvent {
  id: number;
  number: number;
  title: string;
  htmlUrl: string;
  userLogin: string | null;
  createdAtMs: number;
  updatedAtMs: number;
}

export interface GithubRepoTarget {
  projectId: number;
  projectName: string;
  owner: string;
  repo: string;
  repoKey: string;
}
