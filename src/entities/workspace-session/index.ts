export type {
  WorkspaceSession,
  WorkspaceSessionKind,
  WorkspaceSessionStatus,
} from "./model/workspaceSession.types";
export {
  getWorkspaceSessionKind,
  getWorkspaceSessionTargetId,
  getWorkspaceSessionTargetType,
  isAgentSession,
  isTerminalSession,
} from "./lib/workspaceSession.pure";
