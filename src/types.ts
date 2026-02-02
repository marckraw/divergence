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
}

export interface TerminalSession {
  id: string;
  type: "project" | "divergence";
  targetId: number;
  name: string;
  path: string;
  status: "idle" | "active" | "busy";
  lastActivity?: Date;
}

export interface AppState {
  projects: Project[];
  divergences: Map<number, Divergence[]>;
  sessions: Map<string, TerminalSession>;
  activeSessionId: string | null;
}
