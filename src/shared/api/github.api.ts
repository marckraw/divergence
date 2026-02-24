import { getRalphyConfigSummary } from "./ralphyConfig.api";

export interface GithubRepositoryRef {
  owner: string;
  repo: string;
  repoKey: string;
}

export function normalizeGithubRepoKey(owner: string, repo: string): string {
  return `${owner.trim().toLowerCase()}/${repo.trim().toLowerCase()}`;
}

export function isGithubRepoConfigValid(input: { owner?: string | null; repo?: string | null }): boolean {
  return Boolean(input.owner?.trim() && input.repo?.trim());
}

export async function getProjectGithubRepository(projectPath: string): Promise<GithubRepositoryRef | null> {
  const config = await getRalphyConfigSummary(projectPath);
  if (config.status !== "ok") {
    return null;
  }

  const owner = config.summary.integrations?.github?.owner?.trim();
  const repo = config.summary.integrations?.github?.repo?.trim();
  if (!owner || !repo) {
    return null;
  }

  return {
    owner,
    repo,
    repoKey: normalizeGithubRepoKey(owner, repo),
  };
}
