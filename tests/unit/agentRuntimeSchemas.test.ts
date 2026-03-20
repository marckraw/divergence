import { describe, expect, it } from "vitest";
import {
  parseAgentRuntimeCapabilities,
  parseAgentRuntimeSessionSnapshot,
  parseAgentRuntimeSessionSummary,
} from "../../src/shared/api/agentRuntime.schemas";

describe("agentRuntime.schemas", () => {
  it("accepts backend nulls for optional runtime snapshot fields", () => {
    const parsed = parseAgentRuntimeSessionSnapshot({
      id: "agent-1",
      provider: "codex",
      model: "gpt-5.4",
      targetType: "project",
      targetId: 1,
      projectId: 1,
      workspaceOwnerId: null,
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
      threadId: null,
      currentTurnStartedAtMs: null,
      lastRuntimeEventAtMs: null,
      runtimePhase: null,
      conversationContext: null,
      runtimeEvents: [
        {
          id: "evt-1",
          atMs: 15,
          phase: "running",
          message: "Started",
          details: null,
        },
      ],
      messages: [
        {
          id: "msg-1",
          role: "assistant",
          content: "Hi",
          status: "done",
          createdAtMs: 12,
          interactionMode: null,
          attachments: null,
        },
      ],
      activities: [
        {
          id: "act-1",
          kind: "tool",
          title: "Read",
          summary: null,
          subject: null,
          groupKey: null,
          status: "completed",
          details: null,
          startedAtMs: 16,
          completedAtMs: null,
        },
      ],
      pendingRequest: {
        id: "req-1",
        kind: "user-input",
        title: "Need input",
        description: null,
        options: null,
        questions: [
          {
            id: "q-1",
            header: "Question",
            question: "Proceed?",
            isOther: false,
            isSecret: false,
            options: null,
          },
        ],
        status: "open",
        openedAtMs: 18,
        resolvedAtMs: null,
      },
      errorMessage: null,
    });

    expect(parsed.threadId).toBeUndefined();
    expect(parsed.workspaceOwnerId).toBeUndefined();
    expect(parsed.messages[0]?.interactionMode).toBeUndefined();
    expect(parsed.activities[0]?.summary).toBeUndefined();
    expect(parsed.pendingRequest?.description).toBeUndefined();
  });

  it("accepts backend capability transport enums and normalizes them", () => {
    const parsed = parseAgentRuntimeCapabilities({
      placeholderSessionsSupported: true,
      liveStreamingSupported: true,
      persistentSnapshotsSupported: true,
      providers: [
        {
          id: "claude",
          label: "Claude",
          transport: "cliHeadless",
          defaultModel: "sonnet",
          modelOptions: [{ slug: "sonnet", label: "Claude Sonnet" }],
          readiness: {
            status: "ready",
            summary: "Ready",
            details: [],
            binaryCandidates: ["claude"],
            detectedCommand: "claude",
            detectedVersion: "2.1.78 (Claude Code)",
            authStatus: "authenticated",
          },
          features: {
            streaming: true,
            resume: true,
            structuredRequests: false,
            planMode: true,
            attachmentKinds: ["image"],
            structuredPlanUi: false,
            usageInspection: false,
            providerExtras: false,
          },
        },
        {
          id: "codex",
          label: "Codex",
          transport: "appServer",
          defaultModel: "gpt-5.4",
          modelOptions: [{ slug: "gpt-5.4", label: "GPT-5.4" }],
          readiness: {
            status: "ready",
            summary: "Ready",
            details: [],
            binaryCandidates: ["codex"],
            detectedCommand: "codex",
            detectedVersion: "codex-cli 0.115.0",
            authStatus: "authenticated",
          },
          features: {
            streaming: true,
            resume: true,
            structuredRequests: true,
            planMode: true,
            attachmentKinds: ["image"],
            structuredPlanUi: true,
            usageInspection: true,
            providerExtras: true,
          },
        },
      ],
    });

    expect(parsed.providers[0]?.transport).toBe("cli-headless");
    expect(parsed.providers[1]?.transport).toBe("app-server");
    expect(parsed.providers[0]?.readiness.detectedVersion).toBe("2.1.78 (Claude Code)");
    expect(parsed.providers[1]?.readiness.detectedVersion).toBe("codex-cli 0.115.0");
  });

  it("accepts lightweight runtime session summaries", () => {
    const parsed = parseAgentRuntimeSessionSummary({
      id: "agent-2",
      provider: "claude",
      model: "sonnet",
      targetType: "project",
      targetId: 2,
      projectId: 2,
      workspaceOwnerId: null,
      workspaceKey: "project:2",
      sessionRole: "default",
      nameMode: "default",
      name: "Beta",
      path: "/tmp/beta",
      status: "idle",
      runtimeStatus: "idle",
      isOpen: false,
      createdAtMs: 10,
      updatedAtMs: 20,
      threadId: null,
      currentTurnStartedAtMs: null,
      lastRuntimeEventAtMs: 20,
      runtimePhase: "Completed",
      pendingRequest: null,
      errorMessage: null,
      latestAssistantMessageInteractionMode: "plan",
      latestAssistantMessageStatus: "done",
    });

    expect(parsed.workspaceOwnerId).toBeUndefined();
    expect(parsed.threadId).toBeUndefined();
    expect(parsed.latestAssistantMessageInteractionMode).toBe("plan");
    expect(parsed.latestAssistantMessageStatus).toBe("done");
  });
});
