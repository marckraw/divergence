export type BackgroundTaskKind =
  | "create_divergence"
  | "delete_divergence"
  | "remove_project";

export type BackgroundTaskStatus = "queued" | "running" | "success" | "error";

export interface BackgroundTaskTarget {
  type: "project" | "divergence" | "system";
  projectId?: number;
  divergenceId?: number;
  projectName?: string;
  branch?: string;
  path?: string;
  label: string;
}

export interface BackgroundTask {
  id: string;
  kind: BackgroundTaskKind;
  status: BackgroundTaskStatus;
  title: string;
  phase: string;
  progress?: number;
  fsHeavy: boolean;
  retryable: boolean;
  origin: string;
  target: BackgroundTaskTarget;
  createdAtMs: number;
  startedAtMs?: number;
  endedAtMs?: number;
  error?: string;
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
}

export type RunBackgroundTask = <T>(options: BackgroundTaskRunOptions<T>) => Promise<T>;
