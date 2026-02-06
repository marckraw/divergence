import { describe, expect, it } from "vitest";
import type { BackgroundTask } from "../../src/types";
import {
  formatElapsed,
  getRecentTasks,
  getRunningTasks,
  getTaskStatusClass,
  getTaskStatusLabel,
  normalizeUnknownError,
} from "../../src/lib/utils/taskCenter";

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
