import { describe, expect, it } from "vitest";
import type { AgentProposedPlan, AgentSessionSnapshot, TerminalSession } from "../../../entities";
import {
  buildSidebarNeedsAttentionItems,
  getSidebarSessionAttentionState,
  getSidebarAttentionSummary,
} from "./sidebarAttention.pure";

function makeAgentSession(partial: Partial<AgentSessionSnapshot> = {}): AgentSessionSnapshot {
  return {
    kind: "agent",
    id: partial.id ?? "agent-1",
    provider: partial.provider ?? "claude",
    model: partial.model ?? "sonnet",
    targetType: partial.targetType ?? "project",
    targetId: partial.targetId ?? 1,
    projectId: partial.projectId ?? 1,
    workspaceKey: partial.workspaceKey ?? "project:1",
    sessionRole: partial.sessionRole ?? "default",
    nameMode: partial.nameMode ?? "manual",
    name: partial.name ?? "Review",
    path: partial.path ?? "/tmp/project",
    status: partial.status ?? "idle",
    runtimeStatus: partial.runtimeStatus ?? "idle",
    isOpen: partial.isOpen ?? true,
    createdAtMs: partial.createdAtMs ?? 1_000,
    updatedAtMs: partial.updatedAtMs ?? 2_000,
    lastActivity: partial.lastActivity ?? new Date(2_000),
    hydrationState: partial.hydrationState ?? "summary",
    currentTurnStartedAtMs: partial.currentTurnStartedAtMs ?? null,
    lastRuntimeEventAtMs: partial.lastRuntimeEventAtMs ?? 2_000,
    runtimePhase: partial.runtimePhase ?? null,
    latestAssistantMessageInteractionMode: partial.latestAssistantMessageInteractionMode ?? null,
    latestAssistantMessageStatus: partial.latestAssistantMessageStatus ?? null,
    conversationContext: partial.conversationContext ?? null,
    runtimeEvents: partial.runtimeEvents ?? [],
    messages: partial.messages ?? [],
    activities: partial.activities ?? [],
    proposedPlans: partial.proposedPlans ?? [],
    pendingRequest: partial.pendingRequest ?? null,
    errorMessage: partial.errorMessage ?? null,
    threadId: partial.threadId,
    workspaceOwnerId: partial.workspaceOwnerId,
  };
}

function makeProposedPlan(partial: Partial<AgentProposedPlan> = {}): AgentProposedPlan {
  return {
    id: partial.id ?? "plan-1",
    sourceMessageId: partial.sourceMessageId ?? "assistant-1",
    sourceTurnInteractionMode: "plan",
    title: partial.title ?? "Plan ready",
    planMarkdown: partial.planMarkdown ?? "1. First step",
    status: partial.status ?? "proposed",
    createdAtMs: partial.createdAtMs ?? 2_000,
    updatedAtMs: partial.updatedAtMs ?? 2_000,
    implementedAtMs: partial.implementedAtMs ?? null,
    implementationSessionId: partial.implementationSessionId ?? null,
  };
}

function makeTerminalSession(partial: Partial<TerminalSession> = {}): TerminalSession {
  return {
    id: partial.id ?? "terminal-1",
    type: partial.type ?? "project",
    targetId: partial.targetId ?? 1,
    projectId: partial.projectId ?? 1,
    workspaceOwnerId: partial.workspaceOwnerId,
    workspaceKey: partial.workspaceKey ?? "project:1",
    sessionRole: partial.sessionRole ?? "default",
    name: partial.name ?? "default",
    path: partial.path ?? "/tmp/project",
    useTmux: partial.useTmux ?? true,
    tmuxSessionName: partial.tmuxSessionName ?? "project-1",
    tmuxHistoryLimit: partial.tmuxHistoryLimit ?? 50_000,
    status: partial.status ?? "idle",
    lastActivity: partial.lastActivity ?? new Date(1_500),
    portEnv: partial.portEnv,
  };
}

describe("sidebarAttention.pure", () => {
  it("aggregates the highest-priority child attention state", () => {
    const summary = getSidebarAttentionSummary([
      makeAgentSession({
        id: "ready",
        lastRuntimeEventAtMs: 2_000,
      }),
      makeAgentSession({
        id: "approval",
        pendingRequest: {
          id: "req-1",
          kind: "approval",
          title: "Approve command",
          status: "open",
          openedAtMs: 2_000,
        },
      }),
    ], {
      activeSessionId: null,
      idleAttentionSessionIds: new Set<string>(),
      lastViewedRuntimeEventAtMsBySessionId: new Map([
        ["ready", 1_000],
      ]),
    });

    expect(summary).toEqual({
      state: expect.objectContaining({ kind: "approval-required" }),
      count: 2,
    });
  });

  it("builds a sorted needs-you list and keeps the active session available", () => {
    const items = buildSidebarNeedsAttentionItems([
      makeAgentSession({
        id: "input",
        pendingRequest: {
          id: "req-2",
          kind: "user-input",
          title: "Need context",
          status: "open",
          openedAtMs: 2_000,
        },
      }),
      makeAgentSession({
        id: "plan",
        proposedPlans: [makeProposedPlan()],
        updatedAtMs: 3_000,
      }),
      makeTerminalSession({
        id: "terminal-ready",
      }),
    ], {
      activeSessionId: "input",
      idleAttentionSessionIds: new Set(["terminal-ready"]),
      lastViewedRuntimeEventAtMsBySessionId: new Map<string, number>(),
    });

    expect(items.map((item) => item.session.id)).toEqual(["input", "plan", "terminal-ready"]);
    expect(items.map((item) => item.attentionState.kind)).toEqual(["awaiting-input", "plan-ready", "completed"]);
  });

  it("resolves per-session sidebar attention from shared attention inputs", () => {
    const attentionState = getSidebarSessionAttentionState(makeTerminalSession({
      id: "terminal-ready",
    }), {
      activeSessionId: null,
      idleAttentionSessionIds: new Set(["terminal-ready"]),
      lastViewedRuntimeEventAtMsBySessionId: new Map<string, number>(),
      dismissedAttentionKeyBySessionId: new Map<string, string>(),
    });

    expect(attentionState).toEqual(expect.objectContaining({ kind: "completed" }));
  });

  it("hides dismissed sidebar attention for the same fingerprint", () => {
    const attentionState = getSidebarSessionAttentionState(makeAgentSession({
      id: "input",
      pendingRequest: {
        id: "req-2",
        kind: "user-input",
        title: "Need context",
        status: "open",
        openedAtMs: 2_000,
      },
    }), {
      activeSessionId: null,
      idleAttentionSessionIds: new Set<string>(),
      lastViewedRuntimeEventAtMsBySessionId: new Map<string, number>(),
      dismissedAttentionKeyBySessionId: new Map([["input", "input:req-2"]]),
    });

    expect(attentionState).toBeNull();
  });
});
