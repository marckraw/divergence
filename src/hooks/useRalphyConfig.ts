import { useCallback, useEffect, useState } from "react";
import { getErrorMessage } from "../lib/utils/errors";
import { getRalphyConfigSummary } from "../shared/api/ralphyConfig.api";
import type { RalphyConfigResponse } from "../shared/api/ralphyConfig.types";

export type {
  RalphyClaudeSummary,
  RalphyConfigResponse,
  RalphyConfigSummary,
  RalphyGithubIntegrationSummary,
  RalphyIntegrationsSummary,
  RalphyLabelsSummary,
} from "../shared/api/ralphyConfig.types";

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
      const response = await getRalphyConfigSummary(projectPath);
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
