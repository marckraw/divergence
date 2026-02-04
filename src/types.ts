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

export type SplitOrientation = "vertical" | "horizontal";

export interface AppState {
  projects: Project[];
  divergences: Map<number, Divergence[]>;
  sessions: Map<string, TerminalSession>;
  activeSessionId: string | null;
}
