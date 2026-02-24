export type { Automation, AutomationRun } from "../../../shared/api/schema.types";

export type AutomationAgent = "claude" | "codex";
export type AutomationRunMode = "schedule" | "event";
export type AutomationTriggerType = "github_pr_merged";

export type AutomationRunTriggerSource = "schedule" | "manual" | "startup_catchup";

export type AutomationRunStatus = "queued" | "running" | "success" | "error" | "skipped" | "cancelled";

export interface GithubPrMergedTriggerConfig {
  baseBranches: string[];
}

export interface CreateAutomationInput {
  name: string;
  projectId: number;
  agent: AutomationAgent;
  prompt: string;
  intervalHours?: number;
  runMode?: AutomationRunMode;
  sourceProjectId?: number | null;
  targetProjectId?: number | null;
  triggerType?: AutomationTriggerType | null;
  triggerConfigJson?: string | null;
  enabled: boolean;
  keepSessionAlive: boolean;
  workspaceId?: number | null;
}

export interface UpdateAutomationInput extends CreateAutomationInput {
  id: number;
}

export interface CreateAutomationRunInput {
  automationId: number;
  triggerSource: AutomationRunTriggerSource;
  status: AutomationRunStatus;
  startedAtMs?: number | null;
  endedAtMs?: number | null;
  error?: string | null;
  detailsJson?: string | null;
  keepSessionAlive?: boolean;
  tmuxSessionName?: string | null;
  logFilePath?: string | null;
  resultFilePath?: string | null;
  divergenceId?: number | null;
}
