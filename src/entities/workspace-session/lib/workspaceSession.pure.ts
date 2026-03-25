import type { AgentSessionSnapshot } from "../../agent-session";
import type { EditorSession } from "../../editor-session";
import type { TerminalSession } from "../../terminal-session";
import type { WorkspaceSession, WorkspaceSessionKind } from "../model/workspaceSession.types";

export function isAgentSession(session: WorkspaceSession): session is AgentSessionSnapshot {
  return "kind" in session && session.kind === "agent";
}

export function isEditorSession(session: WorkspaceSession): session is EditorSession {
  return "kind" in session && session.kind === "editor";
}

export function isTerminalSession(session: WorkspaceSession): session is TerminalSession {
  return !isAgentSession(session) && !isEditorSession(session);
}

export function getWorkspaceSessionKind(session: WorkspaceSession): WorkspaceSessionKind {
  if (isAgentSession(session)) {
    return "agent";
  }

  if (isEditorSession(session)) {
    return "editor";
  }

  return "terminal";
}

export function getWorkspaceSessionTargetType(
  session: WorkspaceSession
): "project" | "divergence" | "workspace" | "workspace_divergence" {
  if (isAgentSession(session) || isEditorSession(session)) {
    return session.targetType;
  }

  return session.type;
}

export function getWorkspaceSessionTargetId(session: WorkspaceSession): number {
  return session.targetId;
}
