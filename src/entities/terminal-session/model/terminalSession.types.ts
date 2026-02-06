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
