export interface AutomationTmuxStatus {
  alive: boolean;
  exitCode: number | null;
}

export interface AutomationResultFile {
  status: "completed";
  exitCode: number;
  startedAt: string;
  finishedAt: string;
  errorCategory?: "auth" | "general";
}

export interface AutomationRunPollerState {
  runId: number;
  tmuxSessionName: string;
  logFilePath: string;
  resultFilePath: string;
}
