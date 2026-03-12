import type { AgentSessionSnapshot, WorkspaceSession } from "../../../entities";
import { isAgentSession } from "../../../entities";

export type WorkspaceSessionAttentionKind =
  | "approval-required"
  | "awaiting-input"
  | "working"
  | "error"
  | "plan-ready"
  | "completed";

export interface WorkspaceSessionAttentionState {
  kind: WorkspaceSessionAttentionKind;
  label: string;
  tone: "danger" | "warning" | "accent" | "success";
  pulse: boolean;
}

function getLatestAssistantMessage(session: AgentSessionSnapshot) {
  return [...session.messages]
    .reverse()
    .find((message) => message.role === "assistant");
}

function isPlanReady(session: AgentSessionSnapshot): boolean {
  if (session.pendingRequest) {
    return false;
  }

  if (session.runtimeStatus === "running" || session.runtimeStatus === "waiting") {
    return false;
  }

  const latestAssistantMessage = getLatestAssistantMessage(session);
  return latestAssistantMessage?.interactionMode === "plan" && latestAssistantMessage.status === "done";
}

export function getWorkspaceSessionAttentionState(
  session: WorkspaceSession,
  options?: {
    isActive?: boolean;
    lastViewedRuntimeEventAtMs?: number | null;
  },
): WorkspaceSessionAttentionState | null {
  if (!isAgentSession(session)) {
    return null;
  }

  if (session.pendingRequest?.kind === "approval") {
    return {
      kind: "approval-required",
      label: "Approve",
      tone: "danger",
      pulse: true,
    };
  }

  if (session.pendingRequest?.kind === "user-input") {
    return {
      kind: "awaiting-input",
      label: "Input",
      tone: "warning",
      pulse: true,
    };
  }

  if (
    session.runtimeStatus === "running"
    || session.runtimeStatus === "waiting"
    || session.status === "busy"
  ) {
    return {
      kind: "working",
      label: "Working",
      tone: "warning",
      pulse: true,
    };
  }

  if (session.runtimeStatus === "error" || Boolean(session.errorMessage)) {
    return {
      kind: "error",
      label: "Error",
      tone: "danger",
      pulse: false,
    };
  }

  if (isPlanReady(session)) {
    return {
      kind: "plan-ready",
      label: "Plan",
      tone: "accent",
      pulse: false,
    };
  }

  const lastRuntimeEventAtMs = session.lastRuntimeEventAtMs;
  const lastViewedRuntimeEventAtMs = options?.lastViewedRuntimeEventAtMs ?? null;
  if (
    options?.isActive !== true
    && lastRuntimeEventAtMs !== null
    && lastRuntimeEventAtMs !== undefined
    && lastRuntimeEventAtMs > (lastViewedRuntimeEventAtMs ?? 0)
  ) {
    return {
      kind: "completed",
      label: "Ready",
      tone: "success",
      pulse: false,
    };
  }

  return null;
}
