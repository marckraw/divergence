import type { TerminalSession } from "../../../entities";
import type { PromptQueueScopeType } from "../../../entities/prompt-queue";

export interface PromptQueueScope {
  scopeType: PromptQueueScopeType;
  scopeId: number;
}

export function resolvePromptQueueScope(
  session: Pick<TerminalSession, "type" | "projectId" | "targetId" | "workspaceOwnerId"> | null,
): PromptQueueScope | null {
  if (!session) {
    return null;
  }

  if (session.type === "project" || session.type === "divergence") {
    if (session.projectId <= 0) return null;
    return {
      scopeType: "project",
      scopeId: session.projectId,
    };
  }

  const workspaceScopeId = session.workspaceOwnerId ?? session.targetId;
  if (workspaceScopeId <= 0) {
    return null;
  }

  return {
    scopeType: "workspace",
    scopeId: workspaceScopeId,
  };
}
