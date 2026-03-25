import type { AgentProposedPlan, AgentSessionSnapshot } from "../../agent-session";
import type { WorkspaceSession } from "../model/workspaceSession.types";
import { isAgentSession, isEditorSession } from "./workspaceSession.pure";

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

function getLatestProposedPlan(session: AgentSessionSnapshot): AgentProposedPlan | null {
  let latestPlan: AgentProposedPlan | null = null;
  session.proposedPlans.forEach((plan) => {
    if (plan.status !== "proposed") {
      return;
    }

    if (!latestPlan || plan.updatedAtMs > latestPlan.updatedAtMs) {
      latestPlan = plan;
    }
  });

  return latestPlan;
}

function isPlanReady(session: AgentSessionSnapshot): boolean {
  if (session.pendingRequest) {
    return false;
  }

  if (session.runtimeStatus === "running" || session.runtimeStatus === "waiting") {
    return false;
  }

  return getLatestProposedPlan(session) !== null;
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
    if (isEditorSession(session)) {
      return null;
    }
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

  const latestProposedPlan = getLatestProposedPlan(session);
  if (latestProposedPlan) {
    return `plan-ready:${latestProposedPlan.id}:${latestProposedPlan.updatedAtMs}`;
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
