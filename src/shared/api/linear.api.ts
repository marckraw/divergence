import { invoke } from "@tauri-apps/api/core";
import { getRalphyConfigSummary } from "./ralphyConfig.api";

export interface LinearProjectRef {
  projectId: string;
  projectName: string | null;
  teamId: string | null;
}

export interface LinearProjectIssue {
  id: string;
  identifier: string;
  title: string;
  description: string | null;
  stateName: string | null;
  stateType: string | null;
  assigneeName: string | null;
  url: string | null;
  updatedAtMs: number | null;
}

export async function getProjectLinearRef(projectPath: string): Promise<LinearProjectRef | null> {
  const config = await getRalphyConfigSummary(projectPath);
  if (config.status !== "ok") {
    return null;
  }

  const providerType = config.summary.provider_type?.trim().toLowerCase();
  if (providerType && providerType !== "linear") {
    return null;
  }

  const projectId = config.summary.project_id?.trim();
  if (!projectId) {
    return null;
  }

  return {
    projectId,
    projectName: config.summary.project_name?.trim() || null,
    teamId: config.summary.team_id?.trim() || null,
  };
}

export async function fetchLinearProjectIssues(
  token: string,
  projectId: string,
): Promise<LinearProjectIssue[]> {
  return invoke<LinearProjectIssue[]>("fetch_linear_project_issues", {
    token,
    projectId,
  });
}
