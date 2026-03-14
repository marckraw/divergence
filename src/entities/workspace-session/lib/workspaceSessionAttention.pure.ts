import type { AgentSessionSnapshot } from "../../agent-session";
import type { WorkspaceSession } from "../model/workspaceSession.types";
import { isAgentSession } from "./workspaceSession.pure";

export type WorkspaceSessionAttentionKind =
  | "approval-required"
  | "awaiting-input"
  | "error"
  | "plan-ready"
  | "completed"
  | "working";

export interface WorkspaceSessionAttentionState {
  kind: WorkspaceSessionAttentionKind;
  label: string;
  tone: "danger" | "warning" | "accent" | "success";
  pulse: boolean;
}

export interface WorkspaceSessionAttentionOptions {
  isActive?: boolean;
  hasIdleAttention?: boolean;
  lastViewedRuntimeEventAtMs?: number | null;
  dismissedAttentionKey?: string | null;
}

function getLatestAssistantMessage(session: AgentSessionSnapshot) {
  for (let index = session.messages.length - 1; index >= 0; index -= 1) {
    const message = session.messages[index];
    if (message?.role === "assistant") {
      return message;
    }
  }
  return null;
}

function isPlanReady(session: AgentSessionSnapshot): boolean {
  if (session.pendingRequest) {
    return false;
  }

  if (session.runtimeStatus === "running" || session.runtimeStatus === "waiting") {
    return false;
  }

  const latestAssistantMessage = getLatestAssistantMessage(session);
  const latestAssistantInteractionMode = latestAssistantMessage?.interactionMode
    ?? session.latestAssistantMessageInteractionMode;
  const latestAssistantStatus = latestAssistantMessage?.status
    ?? session.latestAssistantMessageStatus;
  return latestAssistantInteractionMode === "plan" && latestAssistantStatus === "done";
}

const ATTENTION_PRIORITY: Record<WorkspaceSessionAttentionKind, number> = {
  "approval-required": 0,
  "awaiting-input": 1,
  error: 2,
  "plan-ready": 3,
  completed: 4,
  working: 5,
};

export function getWorkspaceSessionAttentionPriority(
  attentionState: WorkspaceSessionAttentionState | null | undefined,
): number {
  if (!attentionState) {
    return Number.POSITIVE_INFINITY;
  }
  return ATTENTION_PRIORITY[attentionState.kind];
}

export function getWorkspaceSessionAttentionKey(
  session: WorkspaceSession,
  options?: Omit<WorkspaceSessionAttentionOptions, "isActive" | "dismissedAttentionKey">,
): string | null {
  if (!isAgentSession(session)) {
    if (!options?.hasIdleAttention) {
      return null;
    }
    return `completed:${session.lastActivity?.getTime() ?? 0}`;
  }

  if (session.pendingRequest?.kind === "approval") {
    return `approval:${session.pendingRequest.id}`;
  }

  if (session.pendingRequest?.kind === "user-input") {
    return `input:${session.pendingRequest.id}`;
  }

  if (session.runtimeStatus === "error" || Boolean(session.errorMessage)) {
    return `error:${session.lastRuntimeEventAtMs ?? session.updatedAtMs}:${session.errorMessage ?? ""}`;
  }

  if (isPlanReady(session)) {
    return `plan-ready:${session.lastRuntimeEventAtMs ?? session.updatedAtMs}`;
  }

  const lastRuntimeEventAtMs = session.lastRuntimeEventAtMs;
  const lastViewedRuntimeEventAtMs = options?.lastViewedRuntimeEventAtMs ?? null;
  if (
    lastRuntimeEventAtMs !== null
    && lastRuntimeEventAtMs !== undefined
    && lastRuntimeEventAtMs > (lastViewedRuntimeEventAtMs ?? 0)
  ) {
    return `completed:${lastRuntimeEventAtMs}`;
  }

  return null;
}

export function compareWorkspaceSessionAttentionPriority(
  left: WorkspaceSessionAttentionState | null | undefined,
  right: WorkspaceSessionAttentionState | null | undefined,
): number {
  return getWorkspaceSessionAttentionPriority(left) - getWorkspaceSessionAttentionPriority(right);
}

export function isWorkspaceSessionNeedsAttention(
  attentionState: WorkspaceSessionAttentionState | null | undefined,
): boolean {
  if (!attentionState) {
    return false;
  }

  return attentionState.kind !== "working";
}

export function getWorkspaceSessionAttentionState(
  session: WorkspaceSession,
  options?: WorkspaceSessionAttentionOptions,
): WorkspaceSessionAttentionState | null {
  const isActive = options?.isActive === true;
  const dismissedAttentionKey = options?.dismissedAttentionKey ?? null;

  if (!isAgentSession(session)) {
    const terminalAttentionKey = getWorkspaceSessionAttentionKey(session, options);
    if (!terminalAttentionKey || isActive || terminalAttentionKey === dismissedAttentionKey) {
      return null;
    }
    return {
      kind: "completed",
      label: "Ready",
      tone: "success",
      pulse: false,
    };
  }

  const attentionKey = getWorkspaceSessionAttentionKey(session, options);
  if (attentionKey && attentionKey === dismissedAttentionKey) {
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

  if (session.runtimeStatus === "error" || Boolean(session.errorMessage)) {
    return {
      kind: "error",
      label: "Error",
      tone: "danger",
      pulse: false,
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
    !isActive
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
