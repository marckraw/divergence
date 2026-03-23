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
  isEditorSession,
  isTerminalSession,
} from "./lib/workspaceSession.pure";
export type {
  WorkspaceSessionAttentionOptions,
  WorkspaceSessionAttentionKind,
  WorkspaceSessionAttentionState,
} from "./lib/workspaceSessionAttention.pure";
export {
  compareWorkspaceSessionAttentionPriority,
  getWorkspaceSessionAttentionKey,
  getWorkspaceSessionAttentionPriority,
  getWorkspaceSessionAttentionState,
  isWorkspaceSessionNeedsAttention,
} from "./lib/workspaceSessionAttention.pure";
