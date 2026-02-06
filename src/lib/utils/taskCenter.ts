import type { BackgroundTask } from "../../types";

export function formatElapsed(startedAtMs?: number, endedAtMs?: number, nowMs?: number): string {
  if (!startedAtMs) {
    return "waiting";
  }

  const end = endedAtMs ?? nowMs ?? Date.now();
  const durationMs = Math.max(0, end - startedAtMs);
  const totalSeconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}

export function getTaskStatusLabel(task: Pick<BackgroundTask, "status">): string {
  if (task.status === "queued") {
    return "Queued";
  }
  if (task.status === "running") {
    return "Running";
  }
  if (task.status === "success") {
    return "Success";
  }
  return "Failed";
}

export function getTaskStatusClass(task: Pick<BackgroundTask, "status">): string {
  if (task.status === "success") {
    return "text-green";
  }
  if (task.status === "error") {
    return "text-red";
  }
  if (task.status === "queued") {
    return "text-yellow";
  }
  return "text-accent";
}

export function normalizeUnknownError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }
  return new Error(String(error));
}

export function getRunningTasks(tasks: BackgroundTask[]): BackgroundTask[] {
  return tasks
    .filter((task) => task.status === "queued" || task.status === "running")
    .sort((a, b) => b.createdAtMs - a.createdAtMs);
}

export function getRecentTasks(tasks: BackgroundTask[], maxRecentTasks: number): BackgroundTask[] {
  return tasks
    .filter((task) => task.status === "success" || task.status === "error")
    .sort((a, b) => (b.endedAtMs ?? b.createdAtMs) - (a.endedAtMs ?? a.createdAtMs))
    .slice(0, maxRecentTasks);
}
