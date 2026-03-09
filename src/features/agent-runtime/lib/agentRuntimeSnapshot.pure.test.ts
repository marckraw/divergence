import { describe, expect, it } from "vitest";
import { mapAgentRuntimeSnapshot } from "./agentRuntimeSnapshot.pure";

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
      runtimeEvents: [],
      messages: [],
      activities: [],
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
    expect(snapshot.lastActivity?.getTime()).toBe(20);
  });
});
