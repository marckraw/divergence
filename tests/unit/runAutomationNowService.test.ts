import { describe, expect, it, vi } from "vitest";
import type { AgentSessionSnapshot, RunBackgroundTask } from "../../src/entities";
import type { Automation } from "../../src/entities/automation";
import {
  runAutomationNow,
  type RunAutomationNowDependencies,
} from "../../src/features/automations/service/runAutomationNow.service";

const MOCK_DIVERGENCE_PATH = "/divergences/mock-divergence";

function createAutomation(overrides: Partial<Automation> = {}): Automation {
  return {
    id: 7,
    name: "Manual audit",
    projectId: 2,
    agent: "claude",
    prompt: "Check regressions.",
    intervalHours: 5,
    runMode: "schedule",
    sourceProjectId: null,
    targetProjectId: null,
    triggerType: null,
    triggerConfigJson: null,
    enabled: true,
    keepSessionAlive: false,
    lastRunAtMs: null,
    nextRunAtMs: 9000,
    createdAtMs: 1000,
    updatedAtMs: 1000,
    workspaceId: null,
    ...overrides,
  };
}

function createAgentSessionSnapshot(
  overrides: Partial<AgentSessionSnapshot> = {}
): AgentSessionSnapshot {
  return {
    kind: "agent",
    id: overrides.id ?? "agent-session-1",
    provider: overrides.provider ?? "claude",
    targetType: overrides.targetType ?? "divergence",
    targetId: overrides.targetId ?? 42,
    projectId: overrides.projectId ?? 2,
    workspaceOwnerId: overrides.workspaceOwnerId,
    workspaceKey: overrides.workspaceKey ?? "divergence:42",
    sessionRole: overrides.sessionRole ?? "manual",
    name: overrides.name ?? "Automation: Manual audit",
    path: overrides.path ?? MOCK_DIVERGENCE_PATH,
    status: overrides.status ?? "active",
    runtimeStatus: overrides.runtimeStatus ?? "idle",
    createdAtMs: overrides.createdAtMs ?? 1000,
    updatedAtMs: overrides.updatedAtMs ?? 1234,
    lastActivity: overrides.lastActivity ?? new Date(1234),
    threadId: overrides.threadId,
    messages: overrides.messages ?? [
      {
        id: "assistant-1",
        role: "assistant",
        content: "Automation finished cleanly.",
        status: "done",
        createdAtMs: 1234,
      },
    ],
    activities: overrides.activities ?? [],
    pendingRequest: overrides.pendingRequest ?? null,
    errorMessage: overrides.errorMessage ?? null,
  };
}

function createDependencies(
  overrides: Partial<RunAutomationNowDependencies> = {}
): RunAutomationNowDependencies {
  return {
    insertAutomationRun: vi.fn().mockResolvedValue(99),
    updateAutomationRun: vi.fn().mockResolvedValue(undefined),
    updateAutomationRunDivergence: vi.fn().mockResolvedValue(undefined),
    markAutomationRunSchedule: vi.fn().mockResolvedValue(undefined),
    loadProjectSettings: vi.fn().mockResolvedValue({
      projectId: 2,
      copyIgnoredSkip: ["node_modules"],
      useTmux: true,
      useWebgl: true,
      tmuxHistoryLimit: null,
    }),
    createDivergenceRepository: vi.fn().mockResolvedValue({
      id: 0,
      projectId: 2,
      name: "mock-divergence",
      branch: "automation/7-manual-audit-20260101-000000000",
      path: MOCK_DIVERGENCE_PATH,
      createdAt: "2026-01-01T00:00:00Z",
      hasDiverged: false,
    }),
    insertDivergenceRecord: vi.fn().mockResolvedValue(42),
    buildAutomationPromptMarkdown: vi.fn().mockReturnValue("# Prompt"),
    now: vi.fn(() => 1234),
    pollIntervalMs: 0,
    maxPollDurationMs: 4 * 60 * 60 * 1000,
    ...overrides,
  };
}

function createRuntimeMocks(overrides?: {
  createAgentSession?: (input: Parameters<NonNullable<RunAutomationInput["createAgentSession"]>>[0]) => Promise<AgentSessionSnapshot>;
  startAgentTurn?: (sessionId: string, prompt: string, options?: { automationMode?: boolean }) => Promise<void>;
  getAgentSession?: (sessionId: string) => Promise<AgentSessionSnapshot | null>;
}) {
  const createAgentSession = vi.fn(
    overrides?.createAgentSession
      ?? (async () => createAgentSessionSnapshot())
  );
  const startAgentTurn = vi.fn(
    overrides?.startAgentTurn
      ?? (async () => undefined)
  );
  const getAgentSession = vi.fn(
    overrides?.getAgentSession
      ?? (async () => createAgentSessionSnapshot())
  );

  return {
    createAgentSession,
    startAgentTurn,
    getAgentSession,
  };
}

type RunAutomationInput = Parameters<typeof runAutomationNow>[0];

const runTaskNow: RunBackgroundTask = async (options) => {
  return options.run({
    setPhase: () => {},
    setOutputTail: () => {},
  });
};

describe("runAutomationNow service", () => {
  it("marks run as error when project is missing", async () => {
    const deps = createDependencies();
    const runtime = createRuntimeMocks();

    const result = await runAutomationNow({
      automation: createAutomation({ projectId: 999 }),
      project: null,
      runTask: runTaskNow,
      ...runtime,
    }, deps);

    expect(result.status).toBe("error");
    expect(result.error).toContain("Project 999 was not found.");
    expect(runtime.createAgentSession).not.toHaveBeenCalled();
    expect(deps.updateAutomationRun).toHaveBeenCalledWith(
      99,
      expect.objectContaining({ status: "error" })
    );
  });

  it("creates an agent session, starts the turn in automation mode, and returns launched status", async () => {
    const deps = createDependencies();
    const runtime = createRuntimeMocks();

    const result = await runAutomationNow({
      automation: createAutomation(),
      project: { id: 2, name: "repo", path: "/repo" },
      runTask: runTaskNow,
      ...runtime,
    }, deps);

    expect(result.status).toBe("launched");
    expect(result.agentSessionId).toBe("agent-session-1");
    expect(result.divergenceId).toBe(42);
    expect(runtime.createAgentSession).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: "claude",
        targetType: "divergence",
        targetId: 42,
        path: MOCK_DIVERGENCE_PATH,
      })
    );
    expect(runtime.startAgentTurn).toHaveBeenCalledWith(
      "agent-session-1",
      "# Prompt",
      { automationMode: true }
    );
  });

  it("updates the task target and automation run metadata with the agent session", async () => {
    const deps = createDependencies();
    const runtime = createRuntimeMocks();
    let capturedTarget: Record<string, unknown> | undefined;

    const capturingRunTask: RunBackgroundTask = async (options) => {
      capturedTarget = options.target as Record<string, unknown>;
      return options.run({
        setPhase: () => {},
        setOutputTail: () => {},
      });
    };

    await runAutomationNow({
      automation: createAutomation(),
      project: { id: 2, name: "repo", path: "/repo" },
      runTask: capturingRunTask,
      ...runtime,
    }, deps);

    expect(capturedTarget?.agentSessionId).toBe("agent-session-1");
    expect(capturedTarget?.agentProvider).toBe("claude");
    expect(deps.updateAutomationRun).toHaveBeenCalledWith(
      99,
      expect.objectContaining({
        status: "running",
        detailsJson: expect.stringContaining("\"agentSessionId\":\"agent-session-1\""),
      })
    );
    expect(deps.updateAutomationRun).toHaveBeenCalledWith(
      99,
      expect.objectContaining({ status: "success" })
    );
  });

  it("passes triggerSource through to insertAutomationRun and prompt construction", async () => {
    const deps = createDependencies();
    const runtime = createRuntimeMocks();

    await runAutomationNow({
      automation: createAutomation(),
      project: { id: 2, name: "repo", path: "/repo" },
      runTask: runTaskNow,
      triggerSource: "schedule",
      ...runtime,
    }, deps);

    expect(deps.insertAutomationRun).toHaveBeenCalledWith(
      expect.objectContaining({ triggerSource: "schedule" })
    );
    expect(deps.buildAutomationPromptMarkdown).toHaveBeenCalledWith(
      expect.objectContaining({ triggerSource: "schedule" })
    );
  });

  it("uses workspace mode without creating a divergence clone", async () => {
    const deps = createDependencies();
    const runtime = createRuntimeMocks({
      createAgentSession: async (input) => createAgentSessionSnapshot({
        targetType: input.targetType,
        targetId: input.targetId,
        workspaceKey: input.workspaceKey,
        path: input.path,
      }),
    });

    const result = await runAutomationNow({
      automation: createAutomation({ workspaceId: 88 }),
      project: { id: 2, name: "repo", path: "/repo" },
      workspace: { id: 88, name: "Shared", folderPath: "/workspaces/shared" },
      runTask: runTaskNow,
      ...runtime,
    }, deps);

    expect(result.status).toBe("launched");
    expect(deps.createDivergenceRepository).not.toHaveBeenCalled();
    expect(runtime.createAgentSession).toHaveBeenCalledWith(
      expect.objectContaining({
        targetType: "workspace",
        targetId: 88,
        workspaceOwnerId: 88,
        path: "/workspaces/shared",
      })
    );
  });

  it("marks the run as error when the agent session returns an error state", async () => {
    const deps = createDependencies();
    const runtime = createRuntimeMocks({
      getAgentSession: async () => createAgentSessionSnapshot({
        runtimeStatus: "error",
        status: "idle",
        errorMessage: "Agent failed during execution.",
      }),
    });

    const result = await runAutomationNow({
      automation: createAutomation(),
      project: { id: 2, name: "repo", path: "/repo" },
      runTask: runTaskNow,
      ...runtime,
    }, deps);

    expect(result.status).toBe("error");
    expect(result.error).toContain("Agent failed during execution.");
    expect(deps.updateAutomationRun).toHaveBeenCalledWith(
      99,
      expect.objectContaining({
        status: "error",
        error: "Agent failed during execution.",
      })
    );
  });

  it("marks the run as error when the agent session disappears", async () => {
    const deps = createDependencies();
    const runtime = createRuntimeMocks({
      getAgentSession: async () => null,
    });

    const result = await runAutomationNow({
      automation: createAutomation(),
      project: { id: 2, name: "repo", path: "/repo" },
      runTask: runTaskNow,
      ...runtime,
    }, deps);

    expect(result.status).toBe("error");
    expect(result.error).toContain("disappeared");
  });

  it("times out polling when the runtime never completes", async () => {
    let clock = 0;
    const deps = createDependencies({
      now: vi.fn(() => clock),
      maxPollDurationMs: 3 * 60 * 60 * 1000,
    });
    const runtime = createRuntimeMocks({
      getAgentSession: async () => {
        clock += 2 * 60 * 60 * 1000;
        return createAgentSessionSnapshot({
          runtimeStatus: "running",
          status: "busy",
          messages: [],
        });
      },
    });

    const result = await runAutomationNow({
      automation: createAutomation(),
      project: { id: 2, name: "repo", path: "/repo" },
      runTask: runTaskNow,
      ...runtime,
    }, deps);

    expect(result.status).toBe("error");
    expect(result.error).toContain("polling timed out");
    expect(deps.updateAutomationRun).toHaveBeenCalledWith(
      99,
      expect.objectContaining({ status: "error" })
    );
  });

  it("keeps fixed-clock scheduling semantics", async () => {
    const deps = createDependencies();
    const runtime = createRuntimeMocks();

    await runAutomationNow({
      automation: createAutomation({ nextRunAtMs: 9000, intervalHours: 5 }),
      project: { id: 2, name: "repo", path: "/repo" },
      runTask: runTaskNow,
      ...runtime,
    }, deps);

    expect(deps.markAutomationRunSchedule).toHaveBeenCalledWith(
      7,
      expect.objectContaining({
        nextRunAtMs: 9000 + 5 * 60 * 60 * 1000,
      })
    );
  });

  it("marks run as error when divergence creation fails", async () => {
    const deps = createDependencies({
      createDivergenceRepository: vi.fn().mockRejectedValue(new Error("Git clone failed")),
    });
    const runtime = createRuntimeMocks();

    const result = await runAutomationNow({
      automation: createAutomation(),
      project: { id: 2, name: "repo", path: "/repo" },
      runTask: runTaskNow,
      ...runtime,
    }, deps);

    expect(result.status).toBe("error");
    expect(result.error).toContain("Failed to create divergence");
    expect(runtime.createAgentSession).not.toHaveBeenCalled();
  });
});
