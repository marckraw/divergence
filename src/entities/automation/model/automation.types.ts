export type AutomationAgent = "claude" | "codex";

export interface Automation {
  id: number;
  name: string;
  projectId: number;
  agent: AutomationAgent;
  prompt: string;
  intervalHours: number;
  enabled: boolean;
  keepSessionAlive: boolean;
  lastRunAtMs: number | null;
  nextRunAtMs: number | null;
  createdAtMs: number;
  updatedAtMs: number;
}

export type AutomationRunTriggerSource = "schedule" | "manual" | "startup_catchup";

export type AutomationRunStatus = "queued" | "running" | "success" | "error" | "skipped" | "cancelled";

export interface AutomationRun {
  id: number;
  automationId: number;
  triggerSource: AutomationRunTriggerSource;
  status: AutomationRunStatus;
  startedAtMs: number | null;
  endedAtMs: number | null;
  error: string | null;
  detailsJson: string | null;
  keepSessionAlive: boolean;
  tmuxSessionName: string | null;
  logFilePath: string | null;
  resultFilePath: string | null;
}

export interface CreateAutomationInput {
  name: string;
  projectId: number;
  agent: AutomationAgent;
  prompt: string;
  intervalHours: number;
  enabled: boolean;
  keepSessionAlive: boolean;
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
}
