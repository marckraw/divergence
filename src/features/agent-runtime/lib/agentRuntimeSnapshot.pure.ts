import type { AgentSessionSnapshot } from "../../../entities";
import type {
  AgentRuntimeMessage,
  AgentRuntimeSessionSnapshot,
  AgentRuntimeSessionSummary,
} from "../../../shared";

function getLatestAssistantMessage(messages: AgentRuntimeMessage[]) {
  return [...messages].reverse().find((message) => message.role === "assistant");
}

export function mapAgentRuntimeSnapshot(
  snapshot: AgentRuntimeSessionSnapshot
): AgentSessionSnapshot {
  const latestAssistantMessage = getLatestAssistantMessage(snapshot.messages);
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
    hydrationState: "full",
    currentTurnStartedAtMs: snapshot.currentTurnStartedAtMs ?? null,
    lastRuntimeEventAtMs: snapshot.lastRuntimeEventAtMs ?? null,
    runtimePhase: snapshot.runtimePhase ?? null,
    latestAssistantMessageInteractionMode: latestAssistantMessage?.interactionMode ?? null,
    latestAssistantMessageStatus: latestAssistantMessage?.status ?? null,
    conversationContext: snapshot.conversationContext ?? null,
    runtimeEvents: snapshot.runtimeEvents,
    messages: snapshot.messages,
    activities: snapshot.activities,
    pendingRequest: snapshot.pendingRequest,
    errorMessage: snapshot.errorMessage ?? null,
  };
}

export function mapAgentRuntimeSessionSummary(
  summary: AgentRuntimeSessionSummary
): AgentSessionSnapshot {
  return {
    kind: "agent",
    id: summary.id,
    provider: summary.provider,
    model: summary.model,
    targetType: summary.targetType,
    targetId: summary.targetId,
    projectId: summary.projectId,
    workspaceOwnerId: summary.workspaceOwnerId,
    workspaceKey: summary.workspaceKey,
    sessionRole: summary.sessionRole,
    nameMode: summary.nameMode,
    name: summary.name,
    path: summary.path,
    status: summary.status,
    runtimeStatus: summary.runtimeStatus,
    isOpen: summary.isOpen,
    createdAtMs: summary.createdAtMs,
    updatedAtMs: summary.updatedAtMs,
    lastActivity: new Date(summary.updatedAtMs),
    threadId: summary.threadId,
    hydrationState: "summary",
    currentTurnStartedAtMs: summary.currentTurnStartedAtMs ?? null,
    lastRuntimeEventAtMs: summary.lastRuntimeEventAtMs ?? null,
    runtimePhase: summary.runtimePhase ?? null,
    latestAssistantMessageInteractionMode: summary.latestAssistantMessageInteractionMode ?? null,
    latestAssistantMessageStatus: summary.latestAssistantMessageStatus ?? null,
    conversationContext: null,
    runtimeEvents: [],
    messages: [],
    activities: [],
    pendingRequest: summary.pendingRequest,
    errorMessage: summary.errorMessage ?? null,
  };
}
