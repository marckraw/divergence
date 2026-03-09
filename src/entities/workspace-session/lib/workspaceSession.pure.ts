import type { AgentSessionSnapshot } from "../../agent-session";
import type { TerminalSession } from "../../terminal-session";
import type { WorkspaceSession, WorkspaceSessionKind } from "../model/workspaceSession.types";

export function isAgentSession(session: WorkspaceSession): session is AgentSessionSnapshot {
  return "kind" in session && session.kind === "agent";
}

export function isTerminalSession(session: WorkspaceSession): session is TerminalSession {
  return !isAgentSession(session);
}

export function getWorkspaceSessionKind(session: WorkspaceSession): WorkspaceSessionKind {
  return isAgentSession(session) ? "agent" : "terminal";
}

export function getWorkspaceSessionTargetType(
  session: WorkspaceSession
): "project" | "divergence" | "workspace" | "workspace_divergence" {
  return isAgentSession(session) ? session.targetType : session.type;
}

export function getWorkspaceSessionTargetId(session: WorkspaceSession): number {
  return session.targetId;
}
