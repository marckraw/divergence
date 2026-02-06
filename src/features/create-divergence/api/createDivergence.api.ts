import { invoke } from "@tauri-apps/api/core";
import type { Divergence, Project } from "../../../entities";
import { insertDivergenceAndGetId } from "../../../entities/divergence";

interface CreateDivergenceCommandParams {
  project: Project;
  branchName: string;
  copyIgnoredSkip: string[];
  useExistingBranch: boolean;
}

export async function listRemoteBranches(path: string): Promise<string[]> {
  return invoke<string[]>("list_remote_branches", { path });
}

export async function createDivergenceRepository({
  project,
  branchName,
  copyIgnoredSkip,
  useExistingBranch,
}: CreateDivergenceCommandParams): Promise<Divergence> {
  return invoke<Divergence>("create_divergence", {
    projectId: project.id,
    projectName: project.name,
    projectPath: project.path,
    branchName,
    copyIgnoredSkip,
    useExistingBranch,
  });
}

export async function insertDivergenceRecord(divergence: Divergence): Promise<number> {
  const createInput = {
    project_id: divergence.project_id,
    name: divergence.name,
    branch: divergence.branch,
    path: divergence.path,
    created_at: divergence.created_at,
    has_diverged: divergence.has_diverged,
  };
  return insertDivergenceAndGetId(createInput);
}
