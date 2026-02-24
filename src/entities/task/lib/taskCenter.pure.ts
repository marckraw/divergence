import type { BackgroundTask, BackgroundTaskPhaseEvent } from "../model/task.types";
export { normalizeUnknownError } from "../../../shared/lib/errors.pure";

// ── Hydration types ─────────────────────────────────────────────────────────

export interface AutomationRunHydrationInput {
  id: number;
  automationId: number;
  triggerSource: string;
  status: string;
  startedAtMs: number | null;
  endedAtMs: number | null;
  error: string | null;
  tmuxSessionName: string | null;
  logFilePath: string | null;
}

export interface AutomationHydrationLookup {
  name: string;
  projectId: number;
}

export interface ProjectHydrationLookup {
  name: string;
  path: string;
}

// ── Hydration functions ─────────────────────────────────────────────────────

export function automationRunToBackgroundTask(
  run: AutomationRunHydrationInput,
  automation: AutomationHydrationLookup | undefined,
  project: ProjectHydrationLookup | undefined,
): BackgroundTask {
  const isSuccess = run.status === "success";
  const automationName = automation?.name ?? `Automation #${run.automationId}`;
  const projectName = project?.name ?? "Unknown project";

  const createdAtMs = run.startedAtMs ?? run.endedAtMs ?? 0;
  const phase = isSuccess ? "Done" : "Failed";

  const phaseEvents: BackgroundTaskPhaseEvent[] = [];
  if (run.startedAtMs != null) {
    phaseEvents.push({ phase: "Starting", atMs: run.startedAtMs });
  }
  if (run.endedAtMs != null) {
    phaseEvents.push({ phase, atMs: run.endedAtMs });
  }

  return {
    id: `db-automation-run-${run.id}`,
    kind: "automation_run",
    status: isSuccess ? "success" : "error",
    title: `Automation: ${automationName}`,
    phase,
    fsHeavy: false,
    retryable: false,
    origin: `automation_${run.triggerSource}`,
    target: {
      type: "project",
      projectId: automation?.projectId,
      projectName,
      path: project?.path,
      label: `${projectName} / ${automationName}`,
      tmuxSessionName: run.tmuxSessionName ?? undefined,
    },
    createdAtMs,
    startedAtMs: run.startedAtMs ?? undefined,
    endedAtMs: run.endedAtMs ?? undefined,
    error: run.error ?? undefined,
    phaseEvents: phaseEvents.length > 0 ? phaseEvents : undefined,
    dbRunId: run.id,
  };
}

const HYDRATABLE_STATUSES = new Set(["success", "error"]);

export function hydrateTasksFromAutomationRuns(
  runs: AutomationRunHydrationInput[],
  automationById: Map<number, AutomationHydrationLookup>,
  projectById: Map<number, ProjectHydrationLookup>,
): BackgroundTask[] {
  return runs
    .filter((run) => HYDRATABLE_STATUSES.has(run.status))
    .map((run) => {
      const automation = automationById.get(run.automationId);
      const project = automation ? projectById.get(automation.projectId) : undefined;
      return automationRunToBackgroundTask(run, automation, project);
    });
}

// ── Existing utilities ──────────────────────────────────────────────────────

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

