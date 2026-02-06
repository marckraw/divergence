export interface RalphyLabelsSummary {
  candidate?: string;
  ready?: string;
  enriched?: string;
  pr_feedback?: string;
}

export interface RalphyClaudeSummary {
  max_iterations?: number;
  timeout?: number;
  model?: string;
}

export interface RalphyGithubIntegrationSummary {
  owner?: string;
  repo?: string;
}

export interface RalphyIntegrationsSummary {
  github?: RalphyGithubIntegrationSummary;
}

export interface RalphyConfigSummary {
  version?: number;
  provider_type?: string;
  project_name?: string;
  project_key?: string;
  project_id?: string;
  team_id?: string;
  labels?: RalphyLabelsSummary;
  claude?: RalphyClaudeSummary;
  integrations?: RalphyIntegrationsSummary;
}

export type RalphyConfigResponse =
  | { status: "missing"; path: string }
  | { status: "invalid"; path: string; error: string }
  | { status: "ok"; path: string; summary: RalphyConfigSummary };
