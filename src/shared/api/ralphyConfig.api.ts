import { invoke } from "@tauri-apps/api/core";
import type { RalphyConfigResponse } from "./ralphyConfig.types";

export async function getRalphyConfigSummary(projectPath: string): Promise<RalphyConfigResponse> {
  return invoke<RalphyConfigResponse>("get_ralphy_config_summary", {
    projectPath,
  });
}
