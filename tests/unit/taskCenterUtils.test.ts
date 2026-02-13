import { describe, expect, it } from "vitest";
import type { BackgroundTask } from "../../src/types";
import {
  automationRunToBackgroundTask,
  hydrateTasksFromAutomationRuns,
  formatElapsed,
  getRecentTasks,
  getRunningTasks,
  getTaskStatusClass,
  getTaskStatusLabel,
  normalizeUnknownError,
  type AutomationRunHydrationInput,
  type AutomationHydrationLookup,
  type ProjectHydrationLookup,
} from "../../src/entities/task";

function makeTask(partial: Partial<BackgroundTask>): BackgroundTask {
  return {
    id: partial.id ?? "task",
    kind: partial.kind ?? "create_divergence",
    status: partial.status ?? "queued",
    title: partial.title ?? "Task",
    phase: partial.phase ?? "Queued",
    fsHeavy: partial.fsHeavy ?? false,
    retryable: partial.retryable ?? false,
    origin: partial.origin ?? "test",
    target: partial.target ?? { type: "system", label: "system" },
    createdAtMs: partial.createdAtMs ?? 0,
    startedAtMs: partial.startedAtMs,
    endedAtMs: partial.endedAtMs,
    progress: partial.progress,
    error: partial.error,
  };
}

describe("task center utils", () => {
  it("formats elapsed time", () => {
    expect(formatElapsed()).toBe("waiting");
    expect(formatElapsed(0, 0, 0)).toBe("waiting");
    expect(formatElapsed(1000, 65000)).toBe("1m 4s");
    expect(formatElapsed(1000, 5000)).toBe("4s");
  });

  it("maps status labels and classes", () => {
    expect(getTaskStatusLabel(makeTask({ status: "queued" }))).toBe("Queued");
    expect(getTaskStatusLabel(makeTask({ status: "error" }))).toBe("Failed");
    expect(getTaskStatusClass(makeTask({ status: "running" }))).toBe("text-accent");
    expect(getTaskStatusClass(makeTask({ status: "error" }))).toBe("text-red");
  });

  it("normalizes unknown errors", () => {
    const err = new Error("boom");
    expect(normalizeUnknownError(err)).toBe(err);
    expect(normalizeUnknownError("boom").message).toBe("boom");
  });

  it("derives running and recent task lists", () => {
    const tasks = [
      makeTask({ id: "a", status: "queued", createdAtMs: 1 }),
      makeTask({ id: "b", status: "running", createdAtMs: 3 }),
      makeTask({ id: "c", status: "success", createdAtMs: 2, endedAtMs: 8 }),
      makeTask({ id: "d", status: "error", createdAtMs: 4, endedAtMs: 6 }),
    ];

    expect(getRunningTasks(tasks).map((task) => task.id)).toEqual(["b", "a"]);
    expect(getRecentTasks(tasks, 1).map((task) => task.id)).toEqual(["c"]);
  });
});

// ── Hydration tests ─────────────────────────────────────────────────────────

function makeRun(partial: Partial<AutomationRunHydrationInput> = {}): AutomationRunHydrationInput {
  return {
    id: partial.id ?? 1,
    automationId: partial.automationId ?? 10,
    triggerSource: partial.triggerSource ?? "manual",
    status: partial.status ?? "success",
    startedAtMs: "startedAtMs" in partial ? (partial.startedAtMs ?? null) : 1000,
    endedAtMs: "endedAtMs" in partial ? (partial.endedAtMs ?? null) : 2000,
    error: partial.error ?? null,
    tmuxSessionName: partial.tmuxSessionName ?? null,
    logFilePath: partial.logFilePath ?? null,
  };
}

const sampleAutomation: AutomationHydrationLookup = { name: "Daily PR", projectId: 5 };
const sampleProject: ProjectHydrationLookup = { name: "MyProject", path: "/tmp/my-project" };

describe("automationRunToBackgroundTask", () => {
  it("converts a successful run with correct id, status, title, target, timestamps", () => {
    const task = automationRunToBackgroundTask(
      makeRun({ id: 42, startedAtMs: 1000, endedAtMs: 5000 }),
      sampleAutomation,
      sampleProject,
    );

    expect(task.id).toBe("db-automation-run-42");
    expect(task.kind).toBe("automation_run");
    expect(task.status).toBe("success");
    expect(task.title).toBe("Automation: Daily PR");
    expect(task.phase).toBe("Done");
    expect(task.target.label).toBe("MyProject / Daily PR");
    expect(task.target.projectName).toBe("MyProject");
    expect(task.target.path).toBe("/tmp/my-project");
    expect(task.origin).toBe("automation_manual");
    expect(task.createdAtMs).toBe(1000);
    expect(task.startedAtMs).toBe(1000);
    expect(task.endedAtMs).toBe(5000);
    expect(task.fsHeavy).toBe(false);
    expect(task.retryable).toBe(false);
  });

  it("converts a failed run with error status, phase Failed, and error preserved", () => {
    const task = automationRunToBackgroundTask(
      makeRun({ status: "error", error: "Command exited with code 1" }),
      sampleAutomation,
      sampleProject,
    );

    expect(task.status).toBe("error");
    expect(task.phase).toBe("Failed");
    expect(task.error).toBe("Command exited with code 1");
  });

  it("uses fallback title when automation is missing", () => {
    const task = automationRunToBackgroundTask(
      makeRun({ automationId: 999 }),
      undefined,
      undefined,
    );

    expect(task.title).toBe("Automation: Automation #999");
    expect(task.target.label).toBe("Unknown project / Automation #999");
    expect(task.target.projectName).toBe("Unknown project");
  });

  it("uses fallback project name when project is missing", () => {
    const task = automationRunToBackgroundTask(
      makeRun(),
      sampleAutomation,
      undefined,
    );

    expect(task.target.projectName).toBe("Unknown project");
    expect(task.target.label).toBe("Unknown project / Daily PR");
  });

  it("handles null timestamps gracefully", () => {
    const task = automationRunToBackgroundTask(
      makeRun({ startedAtMs: null, endedAtMs: null }),
      sampleAutomation,
      sampleProject,
    );

    expect(task.createdAtMs).toBe(0);
    expect(task.startedAtMs).toBeUndefined();
    expect(task.endedAtMs).toBeUndefined();
  });

  it("preserves tmuxSessionName in target", () => {
    const task = automationRunToBackgroundTask(
      makeRun({ tmuxSessionName: "auto-session-42" }),
      sampleAutomation,
      sampleProject,
    );

    expect(task.target.tmuxSessionName).toBe("auto-session-42");
  });
});

describe("hydrateTasksFromAutomationRuns", () => {
  const automationMap = new Map<number, AutomationHydrationLookup>([
    [10, sampleAutomation],
  ]);
  const projectMap = new Map<number, ProjectHydrationLookup>([
    [5, sampleProject],
  ]);

  it("filters to only success and error statuses", () => {
    const runs = [
      makeRun({ id: 1, status: "success" }),
      makeRun({ id: 2, status: "error" }),
      makeRun({ id: 3, status: "running" }),
      makeRun({ id: 4, status: "queued" }),
      makeRun({ id: 5, status: "skipped" }),
      makeRun({ id: 6, status: "cancelled" }),
    ];

    const tasks = hydrateTasksFromAutomationRuns(runs, automationMap, projectMap);

    expect(tasks).toHaveLength(2);
    expect(tasks.map((t) => t.id)).toEqual([
      "db-automation-run-1",
      "db-automation-run-2",
    ]);
  });

  it("returns empty for no completed runs", () => {
    const runs = [
      makeRun({ id: 1, status: "running" }),
      makeRun({ id: 2, status: "queued" }),
    ];

    const tasks = hydrateTasksFromAutomationRuns(runs, automationMap, projectMap);
    expect(tasks).toHaveLength(0);
  });

  it("returns empty for empty input", () => {
    const tasks = hydrateTasksFromAutomationRuns([], automationMap, projectMap);
    expect(tasks).toHaveLength(0);
  });

  it("handles deleted automations gracefully", () => {
    const runs = [makeRun({ id: 1, automationId: 999, status: "success" })];
    const tasks = hydrateTasksFromAutomationRuns(runs, automationMap, projectMap);

    expect(tasks).toHaveLength(1);
    expect(tasks[0].title).toBe("Automation: Automation #999");
    expect(tasks[0].target.projectName).toBe("Unknown project");
  });
});
