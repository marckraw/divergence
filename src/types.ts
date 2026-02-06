export interface Project {
  id: number;
  name: string;
  path: string;
  created_at: string;
}

export interface Divergence {
  id: number;
  project_id: number;
  name: string;
  branch: string;
  path: string;
  created_at: string;
  has_diverged: number;
}

export type GitChangeStatus = "A" | "M" | "D" | "R" | "C" | "U" | "?";

export interface GitChangeEntry {
  path: string;
  old_path?: string;
  status: GitChangeStatus;
  staged: boolean;
  unstaged: boolean;
  untracked: boolean;
}

export interface TerminalSession {
  id: string;
  type: "project" | "divergence";
  targetId: number;
  projectId: number;
  name: string;
  path: string;
  useTmux: boolean;
  tmuxSessionName: string;
  tmuxHistoryLimit: number;
  useWebgl: boolean;
  rendererType?: "webgl" | "canvas";
  status: "idle" | "active" | "busy";
  lastActivity?: Date;
}

export interface TmuxSessionEntry {
  name: string;
  created: string;
  attached: boolean;
  window_count: number;
  activity: string;
}

export type TmuxSessionOwnership =
  | { kind: "project"; project: Project }
  | { kind: "divergence"; project: Project; divergence: Divergence }
  | { kind: "orphan" }
  | { kind: "unknown" };

export interface TmuxSessionWithOwnership extends TmuxSessionEntry {
  ownership: TmuxSessionOwnership;
}

export type ChangesMode = "working" | "branch";

export type SplitOrientation = "vertical" | "horizontal";

export interface AppState {
  projects: Project[];
  divergences: Map<number, Divergence[]>;
  sessions: Map<string, TerminalSession>;
  activeSessionId: string | null;
}

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
