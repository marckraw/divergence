import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getErrorMessage } from "../lib/utils/errors";

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

export function useRalphyConfig(projectPath: string | null) {
  const [data, setData] = useState<RalphyConfigResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!projectPath) {
      setData(null);
      setLoading(false);
      setError(null);
      return;
    }

    try {
      setLoading(true);
      const response = await invoke<RalphyConfigResponse>("get_ralphy_config_summary", {
        projectPath,
      });
      setData(response);
      setError(null);
    } catch (err) {
      setError(getErrorMessage(err, "Failed to load Ralphy configuration"));
    } finally {
      setLoading(false);
    }
  }, [projectPath]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    data,
    loading,
    error,
    refresh,
  };
}
