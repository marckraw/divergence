import { describe, expect, it } from "vitest";
import type { AgentSessionSnapshot } from "../../../entities";
import { getWorkspaceSessionAttentionState } from "./workspaceSessionAttention.pure";

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
    currentTurnStartedAtMs: partial.currentTurnStartedAtMs ?? null,
    lastRuntimeEventAtMs: partial.lastRuntimeEventAtMs ?? 2_000,
    runtimePhase: partial.runtimePhase ?? null,
    conversationContext: partial.conversationContext ?? null,
    runtimeEvents: partial.runtimeEvents ?? [],
    messages: partial.messages ?? [],
    activities: partial.activities ?? [],
    pendingRequest: partial.pendingRequest ?? null,
    errorMessage: partial.errorMessage ?? null,
    threadId: partial.threadId,
    workspaceOwnerId: partial.workspaceOwnerId,
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

  it("marks plan-ready sessions when the latest assistant turn was a plan", () => {
    const session = makeAgentSession({
      messages: [
        {
          id: "assistant-1",
          role: "assistant",
          content: "Plan ready",
          status: "done",
          createdAtMs: 2_000,
          interactionMode: "plan",
        },
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
});
