import { describe, expect, it } from "vitest";
import {
  createAgentSessionLabel,
  createEmptyAgentSessionSnapshot,
  getAgentSessionTimestamp,
} from "./agentSession.pure";
import type { AgentSession } from "../model/agentSession.types";

function makeSession(partial: Partial<AgentSession> = {}): AgentSession {
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
    nameMode: partial.nameMode ?? "default",
    name: partial.name ?? "Claude",
    path: partial.path ?? "/tmp/project",
    status: partial.status ?? "idle",
    runtimeStatus: partial.runtimeStatus ?? "idle",
    isOpen: partial.isOpen ?? true,
    createdAtMs: partial.createdAtMs ?? 10,
    updatedAtMs: partial.updatedAtMs ?? 20,
    lastActivity: partial.lastActivity,
    workspaceOwnerId: partial.workspaceOwnerId,
    threadId: partial.threadId,
  };
}

describe("createEmptyAgentSessionSnapshot", () => {
  it("creates a snapshot with empty runtime collections", () => {
    const snapshot = createEmptyAgentSessionSnapshot(makeSession());

    expect(snapshot.messages).toEqual([]);
    expect(snapshot.activities).toEqual([]);
    expect(snapshot.currentTurnStartedAtMs).toBeNull();
    expect(snapshot.lastRuntimeEventAtMs).toBeNull();
    expect(snapshot.runtimePhase).toBeNull();
    expect(snapshot.runtimeEvents).toEqual([]);
    expect(snapshot.pendingRequest).toBeNull();
    expect(snapshot.errorMessage).toBeNull();
  });
});

describe("getAgentSessionTimestamp", () => {
  it("returns the latest timestamp", () => {
    expect(getAgentSessionTimestamp(makeSession({ createdAtMs: 5, updatedAtMs: 25 }))).toBe(25);
  });
});

describe("createAgentSessionLabel", () => {
  it("formats review agent labels", () => {
    expect(createAgentSessionLabel("Alpha", "claude", "review-agent")).toBe("Alpha • claude review");
  });

  it("formats default agent labels", () => {
    expect(createAgentSessionLabel("Alpha", "codex", "default")).toBe("Alpha • codex");
  });
});
