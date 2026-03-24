import { describe, expect, it } from "vitest";
import type { AgentProposedPlan, AgentSessionSnapshot, TerminalSession } from "../../../entities";
import {
  compareWorkspaceSessionAttentionPriority,
  getWorkspaceSessionAttentionKey,
  getWorkspaceSessionAttentionPriority,
  getWorkspaceSessionAttentionState,
  isWorkspaceSessionNeedsAttention,
} from "./workspaceSessionAttention.pure";

function makeAgentSession(partial: Partial<AgentSessionSnapshot> = {}): AgentSessionSnapshot {
  return {
    kind: "agent",
    id: partial.id ?? "agent-1",
    provider: partial.provider ?? "codex",
    model: partial.model ?? "gpt-5.4",
    targetType: partial.targetType ?? "divergence",
    targetId: partial.targetId ?? 7,
    projectId: partial.projectId ?? 3,
    workspaceKey: partial.workspaceKey ?? "divergence:7",
    sessionRole: partial.sessionRole ?? "review-agent",
    nameMode: partial.nameMode ?? "manual",
    name: partial.name ?? "PR #12 • codex review",
    path: partial.path ?? "/tmp/review",
    status: partial.status ?? "idle",
    runtimeStatus: partial.runtimeStatus ?? "idle",
    isOpen: partial.isOpen ?? true,
    createdAtMs: partial.createdAtMs ?? 1_000,
    updatedAtMs: partial.updatedAtMs ?? 2_000,
    lastActivity: partial.lastActivity ?? new Date(2_000),
    hydrationState: partial.hydrationState ?? "full",
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
    lastActivity: partial.lastActivity,
    portEnv: partial.portEnv,
  };
}

describe("workspaceSessionAttention.pure", () => {
  it("prioritizes approval requests over everything else", () => {
    const session = makeAgentSession({
      runtimeStatus: "running",
      pendingRequest: {
        id: "req-1",
        kind: "approval",
        title: "Approve command",
        status: "open",
        openedAtMs: 2_000,
      },
    });

    expect(getWorkspaceSessionAttentionState(session)?.kind).toBe("approval-required");
  });

  it("marks plan-ready sessions when there is a proposed plan object", () => {
    const session = makeAgentSession({
      proposedPlans: [makeProposedPlan()],
    });

    expect(getWorkspaceSessionAttentionState(session)?.kind).toBe("plan-ready");
  });

  it("marks plan-ready sessions from summary metadata without full messages", () => {
    const session = makeAgentSession({
      hydrationState: "summary",
      messages: [],
      proposedPlans: [
        makeProposedPlan({
          id: "plan-summary",
          sourceMessageId: null,
          updatedAtMs: 2_100,
        }),
      ],
    });

    expect(getWorkspaceSessionAttentionState(session)?.kind).toBe("plan-ready");
  });

  it("marks completed when there is a newer unseen runtime event", () => {
    const session = makeAgentSession({
      lastRuntimeEventAtMs: 5_000,
    });

    expect(
      getWorkspaceSessionAttentionState(session, {
        lastViewedRuntimeEventAtMs: 4_000,
      })?.kind,
    ).toBe("completed");
  });

  it("does not mark completed while the session is active", () => {
    const session = makeAgentSession({
      lastRuntimeEventAtMs: 5_000,
    });

    expect(
      getWorkspaceSessionAttentionState(session, {
        isActive: true,
        lastViewedRuntimeEventAtMs: 4_000,
      }),
    ).toBeNull();
  });

  it("marks idle-attention terminal sessions as ready", () => {
    const session = makeTerminalSession();

    expect(
      getWorkspaceSessionAttentionState(session, {
        hasIdleAttention: true,
      })?.kind,
    ).toBe("completed");
  });

  it("derives stable keys for attention states", () => {
    const approval = makeAgentSession({
      pendingRequest: {
        id: "req-approval",
        kind: "approval",
        title: "Approve command",
        status: "open",
        openedAtMs: 2_000,
      },
    });
    const terminal = makeTerminalSession({
      lastActivity: new Date(9_000),
    });

    expect(getWorkspaceSessionAttentionKey(approval)).toBe("approval:req-approval");
    expect(getWorkspaceSessionAttentionKey(terminal, { hasIdleAttention: true })).toBe("completed:9000");
  });

  it("suppresses dismissed attention states until the key changes", () => {
    const session = makeAgentSession({
      pendingRequest: {
        id: "req-input",
        kind: "user-input",
        title: "Need clarification",
        status: "open",
        openedAtMs: 2_000,
      },
    });

    expect(
      getWorkspaceSessionAttentionState(session, {
        dismissedAttentionKey: "input:req-input",
      }),
    ).toBeNull();
    expect(
      getWorkspaceSessionAttentionState(session, {
        dismissedAttentionKey: "input:req-old",
      })?.kind,
    ).toBe("awaiting-input");
  });

  it("orders higher-priority states ahead of lower-priority states", () => {
    const approval = getWorkspaceSessionAttentionState(makeAgentSession({
      pendingRequest: {
        id: "req-approval",
        kind: "approval",
        title: "Approve command",
        status: "open",
        openedAtMs: 2_000,
      },
    }));
    const completed = getWorkspaceSessionAttentionState(makeAgentSession({
      lastRuntimeEventAtMs: 5_000,
    }), {
      lastViewedRuntimeEventAtMs: 4_000,
    });

    expect(getWorkspaceSessionAttentionPriority(approval)).toBeLessThan(
      getWorkspaceSessionAttentionPriority(completed),
    );
    expect(compareWorkspaceSessionAttentionPriority(approval, completed)).toBeLessThan(0);
  });

  it("treats non-working states as needs-you attention", () => {
    const working = getWorkspaceSessionAttentionState(makeAgentSession({
      runtimeStatus: "running",
      status: "busy",
    }));
    const input = getWorkspaceSessionAttentionState(makeAgentSession({
      pendingRequest: {
        id: "req-input",
        kind: "user-input",
        title: "Need clarification",
        status: "open",
        openedAtMs: 2_000,
      },
    }));

    expect(isWorkspaceSessionNeedsAttention(working)).toBe(false);
    expect(isWorkspaceSessionNeedsAttention(input)).toBe(true);
  });
});
