export type BackgroundTaskKind =
  | "create_divergence"
  | "delete_divergence"
  | "remove_project"
  | "automation_run";

export type BackgroundTaskStatus = "queued" | "running" | "success" | "error";

export interface BackgroundTaskPhaseEvent {
  phase: string;
  progress?: number;
  atMs: number;
}

export interface BackgroundTaskTarget {
  type: "project" | "divergence" | "system";
  projectId?: number;
  divergenceId?: number;
  projectName?: string;
  branch?: string;
  path?: string;
  label: string;
  tmuxSessionName?: string;
}

export interface BackgroundTask {
  id: string;
  kind: BackgroundTaskKind;
  status: BackgroundTaskStatus;
  title: string;
  phase: string;
  progress?: number;
  lastUpdatedAtMs?: number;
  phaseEvents?: BackgroundTaskPhaseEvent[];
  outputTail?: string;
  outputUpdatedAtMs?: number;
  fsHeavy: boolean;
  retryable: boolean;
  origin: string;
  target: BackgroundTaskTarget;
  createdAtMs: number;
  startedAtMs?: number;
  endedAtMs?: number;
  error?: string;
  dbRunId?: number;
}

export interface BackgroundTaskToast {
  id: string;
  taskId: string;
  kind: "success" | "error";
  message: string;
  createdAtMs: number;
}

export interface BackgroundTaskControls {
  setPhase: (phase: string, progress?: number) => void;
  setOutputTail: (outputTail: string) => void;
}

export interface BackgroundTaskRunOptions<T> {
  kind: BackgroundTaskKind;
  title: string;
  target: BackgroundTaskTarget;
  origin: string;
  fsHeavy: boolean;
  initialPhase?: string;
  run: (controls: BackgroundTaskControls) => Promise<T>;
  successMessage?: string;
  errorMessage?: string;
  dbRunId?: number;
}

export type RunBackgroundTask = <T>(options: BackgroundTaskRunOptions<T>) => Promise<T>;
