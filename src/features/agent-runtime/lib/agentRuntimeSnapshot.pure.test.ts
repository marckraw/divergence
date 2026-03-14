import { describe, expect, it } from "vitest";
import {
  mapAgentRuntimeSessionSummary,
  mapAgentRuntimeSnapshot,
} from "./agentRuntimeSnapshot.pure";

describe("mapAgentRuntimeSnapshot", () => {
  it("maps runtime snapshots into agent session snapshots", () => {
    const snapshot = mapAgentRuntimeSnapshot({
      id: "agent-1",
      provider: "claude",
      model: "sonnet",
      targetType: "project",
      targetId: 1,
      projectId: 1,
      workspaceKey: "project:1",
      sessionRole: "default",
      nameMode: "default",
      name: "Alpha",
      path: "/tmp/alpha",
      status: "active",
      runtimeStatus: "running",
      isOpen: true,
      createdAtMs: 10,
      updatedAtMs: 20,
      threadId: "thread-1",
      currentTurnStartedAtMs: 12,
      lastRuntimeEventAtMs: 18,
      runtimePhase: "Waiting for model",
      conversationContext: {
        status: "available",
        label: "12% left",
        fractionUsed: 0.88,
        fractionRemaining: 0.12,
        detail: "Current conversation context remaining.",
        source: "codex",
      },
      runtimeEvents: [],
      messages: [],
      activities: [
        {
          id: "activity-1",
          kind: "tool",
          title: "Read",
          summary: "Read CLAUDE.md",
          subject: "CLAUDE.md",
          groupKey: "read",
          status: "completed",
          startedAtMs: 15,
          completedAtMs: 16,
        },
      ],
      pendingRequest: null,
      errorMessage: null,
    });

    expect(snapshot.kind).toBe("agent");
    expect(snapshot.model).toBe("sonnet");
    expect(snapshot.isOpen).toBe(true);
    expect(snapshot.threadId).toBe("thread-1");
    expect(snapshot.currentTurnStartedAtMs).toBe(12);
    expect(snapshot.lastRuntimeEventAtMs).toBe(18);
    expect(snapshot.runtimePhase).toBe("Waiting for model");
    expect(snapshot.conversationContext?.label).toBe("12% left");
    expect(snapshot.activities[0]?.summary).toBe("Read CLAUDE.md");
    expect(snapshot.activities[0]?.groupKey).toBe("read");
    expect(snapshot.lastActivity?.getTime()).toBe(20);
    expect(snapshot.hydrationState).toBe("full");
  });
});

describe("mapAgentRuntimeSessionSummary", () => {
  it("maps runtime summaries into lightweight agent session snapshots", () => {
    const summary = mapAgentRuntimeSessionSummary({
      id: "agent-2",
      provider: "gemini",
      model: "gemini-2.5-pro",
      targetType: "project",
      targetId: 2,
      projectId: 2,
      workspaceKey: "project:2",
      sessionRole: "default",
      nameMode: "manual",
      name: "Beta",
      path: "/tmp/beta",
      status: "idle",
      runtimeStatus: "idle",
      isOpen: false,
      createdAtMs: 100,
      updatedAtMs: 120,
      threadId: undefined,
      currentTurnStartedAtMs: null,
      lastRuntimeEventAtMs: 119,
      runtimePhase: "Completed",
      pendingRequest: null,
      errorMessage: null,
      latestAssistantMessageInteractionMode: "plan",
      latestAssistantMessageStatus: "done",
    });

    expect(summary.hydrationState).toBe("summary");
    expect(summary.messages).toEqual([]);
    expect(summary.activities).toEqual([]);
    expect(summary.latestAssistantMessageInteractionMode).toBe("plan");
    expect(summary.latestAssistantMessageStatus).toBe("done");
  });
});
