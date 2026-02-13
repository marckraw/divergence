import { describe, expect, it, vi } from "vitest";
import type { RunBackgroundTask } from "../../src/entities";
import type { Automation } from "../../src/entities/automation";
import {
  runAutomationNow,
  type RunAutomationNowDependencies,
} from "../../src/features/automations/service/runAutomationNow.service";

const VALID_RESULT_JSON = JSON.stringify({
  status: "completed",
  exitCode: 0,
  startedAt: "2025-01-01T00:00:00Z",
  finishedAt: "2025-01-01T00:05:00Z",
});

const VALID_RESULT = {
  status: "completed" as const,
  exitCode: 0,
  startedAt: "2025-01-01T00:00:00Z",
  finishedAt: "2025-01-01T00:05:00Z",
};

const MOCK_DIVERGENCE_PATH = "/divergences/mock-divergence";

function createAutomation(overrides: Partial<Automation> = {}): Automation {
  return {
    id: 7,
    name: "Manual audit",
    projectId: 2,
    agent: "claude",
    prompt: "Check regressions.",
    intervalHours: 5,
    enabled: true,
    keepSessionAlive: false,
    lastRunAtMs: null,
    nextRunAtMs: 9000,
    createdAtMs: 1000,
    updatedAtMs: 1000,
    ...overrides,
  };
}

function createDependencies(
  overrides: Partial<RunAutomationNowDependencies> = {}
): RunAutomationNowDependencies {
  return {
    insertAutomationRun: vi.fn().mockResolvedValue(99),
    updateAutomationRun: vi.fn().mockResolvedValue(undefined),
    updateAutomationRunTmuxSession: vi.fn().mockResolvedValue(undefined),
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
    writeAutomationBriefFile: vi.fn().mockResolvedValue({
      path: `${MOCK_DIVERGENCE_PATH}/.divergence/review-brief.md`,
    }),
    spawnAutomationTmuxSession: vi.fn().mockResolvedValue(undefined),
    queryAutomationTmuxPaneStatus: vi.fn().mockResolvedValue({ alive: false, exitCode: 0 }),
    readAutomationLogTail: vi.fn().mockResolvedValue("agent output here"),
    readAutomationResultFile: vi.fn().mockResolvedValue(VALID_RESULT_JSON),
    killAutomationTmuxSession: vi.fn().mockResolvedValue(undefined),
    parseAutomationResult: vi.fn().mockReturnValue(VALID_RESULT),
    now: vi.fn(() => 1234),
    pollIntervalMs: 0,
    ...overrides,
  };
}

const runTaskNow: RunBackgroundTask = async (options) => {
  return options.run({
    setPhase: () => {},
    setOutputTail: () => {},
  });
};

describe("runAutomationNow service", () => {
  it("marks run as error when project is missing", async () => {
    const deps = createDependencies();
    const runTask = vi.fn(runTaskNow);

    const result = await runAutomationNow({
      automation: createAutomation({ projectId: 999 }),
      project: null,
      runTask,
      agentCommandClaude: "claude -p \"$(cat '{briefPath}')\" --dangerously-skip-permissions",
      agentCommandCodex: "codex exec --dangerously-bypass-approvals-and-sandbox -C \"{workspacePath}\" - < \"{briefPath}\"",
    }, deps);

    expect(result.status).toBe("error");
    expect(result.error).toContain("Project 999 was not found.");
    expect(runTask).not.toHaveBeenCalled();
    expect(deps.updateAutomationRun).toHaveBeenCalledWith(
      99,
      expect.objectContaining({
        status: "error",
      })
    );
    // nextRunAtMs should be recomputed: anchor(9000) + 5h = 9000 + 18_000_000 = 18_009_000
    expect(deps.markAutomationRunSchedule).toHaveBeenCalledWith(
      7,
      expect.objectContaining({
        nextRunAtMs: 9000 + 5 * 60 * 60 * 1000,
      })
    );
  });

  it("reports template configuration errors", async () => {
    const deps = createDependencies();

    const result = await runAutomationNow({
      automation: createAutomation({ agent: "codex" }),
      project: { id: 2, name: "repo", path: "/repo" },
      runTask: runTaskNow,
      agentCommandClaude: "claude -p \"$(cat '{briefPath}')\" --dangerously-skip-permissions",
      agentCommandCodex: "",
    }, deps);

    expect(result.status).toBe("error");
    expect(result.error).toContain("No codex command template configured in settings.");
    expect(deps.spawnAutomationTmuxSession).not.toHaveBeenCalled();
  });

  it("spawns tmux, polls until done, and returns launched status", async () => {
    const deps = createDependencies();

    const result = await runAutomationNow({
      automation: createAutomation(),
      project: { id: 2, name: "repo", path: "/repo" },
      runTask: runTaskNow,
      agentCommandClaude: "claude -p \"$(cat '{briefPath}')\" --dangerously-skip-permissions",
      agentCommandCodex: "",
    }, deps);

    expect(result.status).toBe("launched");
    expect(result.tmuxSessionName).toBe("divergence-auto-7-99");
    expect(deps.spawnAutomationTmuxSession).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionName: "divergence-auto-7-99",
        cwd: MOCK_DIVERGENCE_PATH,
      })
    );
    // Verify monitoring happened
    expect(deps.queryAutomationTmuxPaneStatus).toHaveBeenCalledWith("divergence-auto-7-99");
    expect(deps.readAutomationResultFile).toHaveBeenCalled();
    // Verify finalization
    expect(deps.updateAutomationRun).toHaveBeenCalledWith(
      99,
      expect.objectContaining({
        status: "success",
      })
    );
    expect(deps.killAutomationTmuxSession).toHaveBeenCalledWith("divergence-auto-7-99");
    expect(deps.markAutomationRunSchedule).toHaveBeenCalledWith(
      7,
      expect.objectContaining({
        lastRunAtMs: 1234,
      })
    );
  });

  it("creates brief file before spawning tmux", async () => {
    const deps = createDependencies();

    await runAutomationNow({
      automation: createAutomation(),
      project: { id: 2, name: "repo", path: "/repo" },
      runTask: runTaskNow,
      agentCommandClaude: "claude -p \"$(cat '{briefPath}')\" --dangerously-skip-permissions",
      agentCommandCodex: "",
    }, deps);

    expect(deps.writeAutomationBriefFile).toHaveBeenCalledWith(MOCK_DIVERGENCE_PATH, "# Prompt");
    expect(deps.buildAutomationPromptMarkdown).toHaveBeenCalledWith(
      expect.objectContaining({
        automationName: "Manual audit",
        projectName: "repo",
      })
    );
  });

  it("renders command template with correct tokens", async () => {
    const deps = createDependencies();

    await runAutomationNow({
      automation: createAutomation(),
      project: { id: 2, name: "repo", path: "/repo" },
      runTask: runTaskNow,
      agentCommandClaude: "cat \"{briefPath}\" | claude -p --cwd \"{workspacePath}\"",
      agentCommandCodex: "",
    }, deps);

    const spawnCall = (deps.spawnAutomationTmuxSession as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(spawnCall.command).toContain(`cat "${MOCK_DIVERGENCE_PATH}/.divergence/review-brief.md" | claude -p --cwd "${MOCK_DIVERGENCE_PATH}"`);
  });

  it("marks run as error when agent exits with non-zero code", async () => {
    const failResult = {
      status: "completed" as const,
      exitCode: 1,
      startedAt: "2025-01-01T00:00:00Z",
      finishedAt: "2025-01-01T00:05:00Z",
    };
    const deps = createDependencies({
      queryAutomationTmuxPaneStatus: vi.fn().mockResolvedValue({ alive: false, exitCode: 1 }),
      readAutomationResultFile: vi.fn().mockResolvedValue(JSON.stringify(failResult)),
      parseAutomationResult: vi.fn().mockReturnValue(failResult),
    });

    const result = await runAutomationNow({
      automation: createAutomation(),
      project: { id: 2, name: "repo", path: "/repo" },
      runTask: runTaskNow,
      agentCommandClaude: "claude -p \"$(cat '{briefPath}')\" --dangerously-skip-permissions",
      agentCommandCodex: "",
    }, deps);

    expect(result.status).toBe("error");
    expect(result.error).toContain("Agent exited with code 1");
    expect(deps.updateAutomationRun).toHaveBeenCalledWith(
      99,
      expect.objectContaining({
        status: "error",
        error: "Agent exited with code 1",
      })
    );
  });

  it("updates output tail during polling", async () => {
    let pollCount = 0;
    const deps = createDependencies({
      queryAutomationTmuxPaneStatus: vi.fn().mockImplementation(() => {
        pollCount++;
        if (pollCount <= 2) {
          return Promise.resolve({ alive: true, exitCode: null });
        }
        return Promise.resolve({ alive: false, exitCode: 0 });
      }),
      // Result file only appears after agent exits (not during alive polls)
      readAutomationResultFile: vi.fn().mockImplementation(() => {
        if (pollCount <= 2) {
          return Promise.resolve(null);
        }
        return Promise.resolve(VALID_RESULT_JSON);
      }),
    });

    const outputTails: string[] = [];
    const trackingRunTask: RunBackgroundTask = async (options) => {
      return options.run({
        setPhase: () => {},
        setOutputTail: (tail: string) => { outputTails.push(tail); },
      });
    };

    await runAutomationNow({
      automation: createAutomation(),
      project: { id: 2, name: "repo", path: "/repo" },
      runTask: trackingRunTask,
      agentCommandClaude: "claude -p \"$(cat '{briefPath}')\" --dangerously-skip-permissions",
      agentCommandCodex: "",
    }, deps);

    // Output should have been updated during each poll tick + final read
    expect(outputTails.length).toBeGreaterThanOrEqual(3);
  });

  it("does not kill tmux session when keepSessionAlive is true", async () => {
    const deps = createDependencies();

    await runAutomationNow({
      automation: createAutomation({ keepSessionAlive: true }),
      project: { id: 2, name: "repo", path: "/repo" },
      runTask: runTaskNow,
      agentCommandClaude: "claude -p \"$(cat '{briefPath}')\" --dangerously-skip-permissions",
      agentCommandCodex: "",
    }, deps);

    expect(deps.killAutomationTmuxSession).not.toHaveBeenCalled();
    expect(deps.updateAutomationRun).toHaveBeenCalledWith(
      99,
      expect.objectContaining({ status: "success" })
    );
  });

  it("kills tmux session when keepSessionAlive is false", async () => {
    const deps = createDependencies();

    await runAutomationNow({
      automation: createAutomation({ keepSessionAlive: false }),
      project: { id: 2, name: "repo", path: "/repo" },
      runTask: runTaskNow,
      agentCommandClaude: "claude -p \"$(cat '{briefPath}')\" --dangerously-skip-permissions",
      agentCommandCodex: "",
    }, deps);

    expect(deps.killAutomationTmuxSession).toHaveBeenCalledWith("divergence-auto-7-99");
    expect(deps.updateAutomationRun).toHaveBeenCalledWith(
      99,
      expect.objectContaining({ status: "success" })
    );
  });

  it("passes keepSessionAlive to insertAutomationRun", async () => {
    const deps = createDependencies();

    await runAutomationNow({
      automation: createAutomation({ keepSessionAlive: true }),
      project: { id: 2, name: "repo", path: "/repo" },
      runTask: runTaskNow,
      agentCommandClaude: "claude -p \"$(cat '{briefPath}')\" --dangerously-skip-permissions",
      agentCommandCodex: "",
    }, deps);

    expect(deps.insertAutomationRun).toHaveBeenCalledWith(
      expect.objectContaining({ keepSessionAlive: true })
    );
  });

  it("includes tmuxSessionName in task target", async () => {
    const deps = createDependencies();
    let capturedTarget: Record<string, unknown> | undefined;
    const capturingRunTask: RunBackgroundTask = async (options) => {
      capturedTarget = options.target as unknown as Record<string, unknown>;
      return options.run({
        setPhase: () => {},
        setOutputTail: () => {},
      });
    };

    await runAutomationNow({
      automation: createAutomation(),
      project: { id: 2, name: "repo", path: "/repo" },
      runTask: capturingRunTask,
      agentCommandClaude: "claude -p \"$(cat '{briefPath}')\" --dangerously-skip-permissions",
      agentCommandCodex: "",
    }, deps);

    expect(capturedTarget?.tmuxSessionName).toBe("divergence-auto-7-99");
  });

  it("passes triggerSource through to insertAutomationRun and buildAutomationPromptMarkdown", async () => {
    const deps = createDependencies();

    await runAutomationNow({
      automation: createAutomation(),
      project: { id: 2, name: "repo", path: "/repo" },
      runTask: runTaskNow,
      agentCommandClaude: "claude -p \"$(cat '{briefPath}')\" --dangerously-skip-permissions",
      agentCommandCodex: "",
      triggerSource: "schedule",
    }, deps);

    expect(deps.insertAutomationRun).toHaveBeenCalledWith(
      expect.objectContaining({ triggerSource: "schedule" })
    );
    expect(deps.buildAutomationPromptMarkdown).toHaveBeenCalledWith(
      expect.objectContaining({ triggerSource: "schedule" })
    );
  });

  it("times out polling when maxPollDurationMs is exceeded", async () => {
    let clock = 0;
    const deps = createDependencies({
      now: vi.fn(() => clock),
      queryAutomationTmuxPaneStatus: vi.fn().mockImplementation(() => {
        // Advance clock by 2 hours per poll tick
        clock += 2 * 60 * 60 * 1000;
        return Promise.resolve({ alive: true, exitCode: null });
      }),
      readAutomationResultFile: vi.fn().mockResolvedValue(null),
      pollIntervalMs: 0,
      maxPollDurationMs: 3 * 60 * 60 * 1000, // 3 hour timeout
    });

    const result = await runAutomationNow({
      automation: createAutomation(),
      project: { id: 2, name: "repo", path: "/repo" },
      runTask: runTaskNow,
      agentCommandClaude: "claude -p \"$(cat '{briefPath}')\" --dangerously-skip-permissions",
      agentCommandCodex: "",
    }, deps);

    expect(result.status).toBe("error");
    expect(result.error).toContain("polling timed out");
    expect(result.error).toContain("180 minutes");
    // DB should be finalized to "error" to avoid stuck "running" rows
    expect(deps.updateAutomationRun).toHaveBeenCalledWith(
      99,
      expect.objectContaining({
        status: "error",
      })
    );
    expect(deps.markAutomationRunSchedule).toHaveBeenCalled();
  });

  it("uses fixed-clock scheduling: anchors to scheduled time, not completion time", async () => {
    // Automation scheduled at 9000ms, 5h interval, now() returns 1234 (completion time)
    // Fixed-clock: next = 9000 + 5*3600000 = 18_009_000 (not 1234 + 5*3600000)
    const deps = createDependencies();

    await runAutomationNow({
      automation: createAutomation({ nextRunAtMs: 9000, intervalHours: 5 }),
      project: { id: 2, name: "repo", path: "/repo" },
      runTask: runTaskNow,
      agentCommandClaude: "claude -p \"$(cat '{briefPath}')\" --dangerously-skip-permissions",
      agentCommandCodex: "",
    }, deps);

    expect(deps.markAutomationRunSchedule).toHaveBeenCalledWith(
      7,
      expect.objectContaining({
        nextRunAtMs: 9000 + 5 * 60 * 60 * 1000,
      })
    );
  });

  it("returns null nextRunAtMs when automation is disabled", async () => {
    const deps = createDependencies();

    await runAutomationNow({
      automation: createAutomation({ enabled: false }),
      project: { id: 2, name: "repo", path: "/repo" },
      runTask: runTaskNow,
      agentCommandClaude: "claude -p \"$(cat '{briefPath}')\" --dangerously-skip-permissions",
      agentCommandCodex: "",
    }, deps);

    expect(deps.markAutomationRunSchedule).toHaveBeenCalledWith(
      7,
      expect.objectContaining({
        nextRunAtMs: null,
      })
    );
  });

  it("creates divergence before spawning agent", async () => {
    const deps = createDependencies();

    await runAutomationNow({
      automation: createAutomation(),
      project: { id: 2, name: "repo", path: "/repo" },
      runTask: runTaskNow,
      agentCommandClaude: "claude -p \"$(cat '{briefPath}')\" --dangerously-skip-permissions",
      agentCommandCodex: "",
    }, deps);

    expect(deps.createDivergenceRepository).toHaveBeenCalledWith(
      expect.objectContaining({
        project: { id: 2, name: "repo", path: "/repo" },
        copyIgnoredSkip: ["node_modules"],
        useExistingBranch: false,
      })
    );
    // Branch name should start with automation/7-
    const call = (deps.createDivergenceRepository as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.branchName).toMatch(/^automation\/7-manual-audit-/);
  });

  it("marks run as error when divergence creation fails", async () => {
    const deps = createDependencies({
      createDivergenceRepository: vi.fn().mockRejectedValue(new Error("Git clone failed")),
    });

    const result = await runAutomationNow({
      automation: createAutomation(),
      project: { id: 2, name: "repo", path: "/repo" },
      runTask: runTaskNow,
      agentCommandClaude: "claude -p \"$(cat '{briefPath}')\" --dangerously-skip-permissions",
      agentCommandCodex: "",
    }, deps);

    expect(result.status).toBe("error");
    expect(result.error).toContain("Failed to create divergence");
    expect(result.error).toContain("Git clone failed");
    expect(deps.spawnAutomationTmuxSession).not.toHaveBeenCalled();
    expect(deps.updateAutomationRun).toHaveBeenCalledWith(
      99,
      expect.objectContaining({ status: "error" })
    );
  });

  it("links divergence to automation run", async () => {
    const deps = createDependencies();

    await runAutomationNow({
      automation: createAutomation(),
      project: { id: 2, name: "repo", path: "/repo" },
      runTask: runTaskNow,
      agentCommandClaude: "claude -p \"$(cat '{briefPath}')\" --dangerously-skip-permissions",
      agentCommandCodex: "",
    }, deps);

    expect(deps.updateAutomationRunDivergence).toHaveBeenCalledWith(99, 42);
  });

  it("returns divergenceId in result", async () => {
    const deps = createDependencies();

    const result = await runAutomationNow({
      automation: createAutomation(),
      project: { id: 2, name: "repo", path: "/repo" },
      runTask: runTaskNow,
      agentCommandClaude: "claude -p \"$(cat '{briefPath}')\" --dangerously-skip-permissions",
      agentCommandCodex: "",
    }, deps);

    expect(result.status).toBe("launched");
    expect(result.divergenceId).toBe(42);
  });
});
