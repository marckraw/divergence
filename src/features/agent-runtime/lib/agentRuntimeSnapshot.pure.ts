import type { AgentSessionSnapshot } from "../../../entities";
import type { AgentRuntimeSessionSnapshot } from "../../../shared";

export function mapAgentRuntimeSnapshot(
  snapshot: AgentRuntimeSessionSnapshot
): AgentSessionSnapshot {
  return {
    kind: "agent",
    id: snapshot.id,
    provider: snapshot.provider,
    model: snapshot.model,
    targetType: snapshot.targetType,
    targetId: snapshot.targetId,
    projectId: snapshot.projectId,
    workspaceOwnerId: snapshot.workspaceOwnerId,
    workspaceKey: snapshot.workspaceKey,
    sessionRole: snapshot.sessionRole,
    nameMode: snapshot.nameMode,
    name: snapshot.name,
    path: snapshot.path,
    status: snapshot.status,
    runtimeStatus: snapshot.runtimeStatus,
    isOpen: snapshot.isOpen,
    createdAtMs: snapshot.createdAtMs,
    updatedAtMs: snapshot.updatedAtMs,
    lastActivity: new Date(snapshot.updatedAtMs),
    threadId: snapshot.threadId,
    currentTurnStartedAtMs: snapshot.currentTurnStartedAtMs ?? null,
    lastRuntimeEventAtMs: snapshot.lastRuntimeEventAtMs ?? null,
    runtimePhase: snapshot.runtimePhase ?? null,
    conversationContext: snapshot.conversationContext ?? null,
    runtimeEvents: snapshot.runtimeEvents,
    messages: snapshot.messages,
    activities: snapshot.activities,
    pendingRequest: snapshot.pendingRequest,
    errorMessage: snapshot.errorMessage ?? null,
  };
}
