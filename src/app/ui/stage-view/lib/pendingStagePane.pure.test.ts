import { describe, expect, it } from "vitest";
import type { AgentSessionSnapshot, TerminalSession } from "../../../../entities";
import { buildPendingStagePaneCreateContext } from "./pendingStagePane.pure";

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

function makeAgentSession(partial: Partial<AgentSessionSnapshot> = {}): AgentSessionSnapshot {
  return {
    kind: "agent",
    id: partial.id ?? "agent-1",
    provider: partial.provider ?? "claude",
    model: partial.model ?? "sonnet",
    targetType: partial.targetType ?? "project",
    targetId: partial.targetId ?? 1,
    projectId: partial.projectId ?? 1,
    workspaceOwnerId: partial.workspaceOwnerId,
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
    lastActivity: partial.lastActivity,
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
    pendingRequest: partial.pendingRequest ?? null,
    errorMessage: partial.errorMessage ?? null,
    threadId: partial.threadId,
  };
}

describe("pendingStagePane.pure", () => {
  it("builds project create actions with manual terminal and provider agents", () => {
    const context = buildPendingStagePaneCreateContext(
      makeTerminalSession({
        type: "project",
        targetId: 7,
      }),
      ["claude", "codex"],
    );

    expect(context).toEqual({
      title: "Create from this project",
      description: "Open another session for the same project in this pane.",
      actions: [
        expect.objectContaining({
          label: "New Session",
          targetType: "project",
          targetId: 7,
          sessionKind: "terminal",
        }),
        expect.objectContaining({
          label: "Open Claude Agent",
          targetType: "project",
          targetId: 7,
          sessionKind: "agent",
          provider: "claude",
        }),
        expect.objectContaining({
          label: "Open Codex Agent",
          targetType: "project",
          targetId: 7,
          sessionKind: "agent",
          provider: "codex",
        }),
      ],
    });
  });

  it("uses open-terminal copy for workspace contexts", () => {
    const context = buildPendingStagePaneCreateContext(
      makeAgentSession({
        targetType: "workspace",
        targetId: 12,
        workspaceOwnerId: 12,
      }),
      ["claude"],
    );

    expect(context).toEqual({
      title: "Create from this workspace",
      description: "Open another session for the same workspace in this pane.",
      actions: [
        expect.objectContaining({
          label: "Open Terminal",
          targetType: "workspace",
          targetId: 12,
          sessionKind: "terminal",
        }),
        expect.objectContaining({
          label: "Open Claude Agent",
          targetType: "workspace",
          targetId: 12,
          sessionKind: "agent",
          provider: "claude",
        }),
      ],
    });
  });

  it("returns null without a source session", () => {
    expect(buildPendingStagePaneCreateContext(null, ["claude"])).toBeNull();
  });
});
