export interface TerminalSession {
  id: string;
  type: "project" | "divergence" | "workspace" | "workspace_divergence";
  targetId: number;
  projectId: number;
  workspaceOwnerId?: number;
  workspaceKey: string;
  sessionRole: "default" | "review-agent" | "manual";
  name: string;
  path: string;
  useTmux: boolean;
  tmuxSessionName: string;
  tmuxHistoryLimit: number;
  status: "idle" | "active" | "busy";
  lastActivity?: Date;
  portEnv?: Record<string, string>;
}

export type SplitOrientation = "vertical" | "horizontal";
export type SplitPaneId = "pane-1" | "pane-2" | "pane-3";

export interface SplitSessionState {
  orientation: SplitOrientation;
  paneIds: SplitPaneId[];
  paneSizes?: number[];
  focusedPaneId: SplitPaneId;
  primaryPaneId: SplitPaneId;
}
