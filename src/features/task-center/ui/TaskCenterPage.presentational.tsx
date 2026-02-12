import { useMemo, useState } from "react";
import {
  formatElapsed,
  getTaskStatusClass,
  getTaskStatusLabel,
  type BackgroundTask,
} from "../../../entities/task";
import type { TaskCenterPageProps } from "./TaskCenterPage.types";

interface TaskCenterPagePresentationalProps extends TaskCenterPageProps {
  nowMs: number;
}

function formatRelativeAge(atMs: number | undefined, nowMs: number): string {
  if (!atMs) {
    return "unknown";
  }
  const seconds = Math.max(0, Math.floor((nowMs - atMs) / 1000));
  if (seconds < 2) {
    return "just now";
  }
  if (seconds < 60) {
    return `${seconds}s ago`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}m ${remainder}s ago`;
}

function formatDateTime(atMs: number | undefined): string {
  if (!atMs) {
    return "—";
  }
  return new Date(atMs).toLocaleString();
}

function TaskCenterTaskCard({
  task,
  nowMs,
  focused,
  onRetryTask,
  onViewTask,
  onInspectTask,
}: {
  task: BackgroundTask;
  nowMs: number;
  focused: boolean;
  onRetryTask: (taskId: string) => Promise<void>;
  onViewTask: (taskId: string) => void;
  onInspectTask: (taskId: string) => void;
}) {
  const [isRetrying, setIsRetrying] = useState(false);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onViewTask(task.id)}
      onKeyDown={(event) => {
        if (event.key !== "Enter" && event.key !== " ") {
          return;
        }
        event.preventDefault();
        onViewTask(task.id);
      }}
      className={`w-full text-left rounded-md border p-3 transition-colors ${
        focused ? "border-accent bg-accent/10" : "border-surface bg-sidebar/40 hover:bg-surface/40"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm text-text font-medium truncate">{task.title}</div>
          <div className="text-xs text-subtext truncate">{task.target.label}</div>
        </div>
        <div className={`text-xs font-medium whitespace-nowrap ${getTaskStatusClass(task)}`}>
          {getTaskStatusLabel(task)}
        </div>
      </div>

      <div className="mt-2 text-xs text-subtext">
        <span>{task.phase}</span>
        <span className="mx-1">•</span>
        <span>{formatElapsed(task.startedAtMs, task.endedAtMs, nowMs)}</span>
      </div>
      {task.status === "running" && (
        <div className="mt-1 text-xs text-subtext">
          Last update: {formatRelativeAge(task.lastUpdatedAtMs, nowMs)}
        </div>
      )}

      {typeof task.progress === "number" && task.status === "running" && (
        <div className="mt-2 h-1.5 bg-surface rounded-full overflow-hidden">
          <div className="h-full bg-accent transition-all" style={{ width: `${task.progress}%` }} />
        </div>
      )}

      {task.error && task.status === "error" && (
        <div className="mt-2 text-xs text-red break-words">{task.error}</div>
      )}

      <div className="mt-3 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onInspectTask(task.id);
          }}
          className="px-2 py-1 text-xs rounded border border-surface text-text hover:bg-surface"
        >
          Inspect
        </button>
        {task.status === "error" && task.retryable && (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setIsRetrying(true);
              void onRetryTask(task.id).finally(() => {
                setIsRetrying(false);
              });
            }}
            disabled={isRetrying}
            className="px-2 py-1 text-xs rounded border border-surface text-text hover:bg-surface disabled:opacity-60"
          >
            {isRetrying ? "Retrying..." : "Retry"}
          </button>
        )}
      </div>
    </div>
  );
}

function TaskInspectModal({
  task,
  nowMs,
  onClose,
  onAttachToAutomationSession,
}: {
  task: BackgroundTask;
  nowMs: number;
  onClose: () => void;
  onAttachToAutomationSession?: (task: BackgroundTask) => void;
}) {
  const phaseEvents = (task.phaseEvents ?? []).slice().reverse();

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-md border border-surface bg-sidebar">
        <div className="px-4 py-3 border-b border-surface flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm text-text font-semibold">Task Inspect</h3>
            <p className="text-xs text-subtext mt-1">{task.title}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded border border-surface text-subtext hover:text-text hover:bg-surface"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="rounded border border-surface bg-main p-3">
              <div className="text-subtext">Status</div>
              <div className={`mt-1 font-medium ${getTaskStatusClass(task)}`}>{getTaskStatusLabel(task)}</div>
            </div>
            <div className="rounded border border-surface bg-main p-3">
              <div className="text-subtext">Current phase</div>
              <div className="mt-1 text-text">{task.phase}</div>
            </div>
            <div className="rounded border border-surface bg-main p-3">
              <div className="text-subtext">Duration</div>
              <div className="mt-1 text-text">{formatElapsed(task.startedAtMs, task.endedAtMs, nowMs)}</div>
            </div>
            <div className="rounded border border-surface bg-main p-3">
              <div className="text-subtext">Last update</div>
              <div className="mt-1 text-text">{formatRelativeAge(task.lastUpdatedAtMs, nowMs)}</div>
            </div>
            <div className="rounded border border-surface bg-main p-3">
              <div className="text-subtext">Target</div>
              <div className="mt-1 text-text break-words">{task.target.label}</div>
            </div>
            <div className="rounded border border-surface bg-main p-3">
              <div className="text-subtext">Started</div>
              <div className="mt-1 text-text">{formatDateTime(task.startedAtMs ?? task.createdAtMs)}</div>
            </div>
            {task.target.tmuxSessionName && (
              <div className="rounded border border-surface bg-main p-3 sm:col-span-2">
                <div className="text-subtext">Tmux session</div>
                <div className="mt-1 text-text font-mono break-all select-all">{task.target.tmuxSessionName}</div>
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between gap-3 mb-2">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-subtext">
                Command output tail
              </h4>
              <div className="text-[11px] text-subtext">
                Updated: {formatRelativeAge(task.outputUpdatedAtMs, nowMs)}
              </div>
            </div>
            <pre className="rounded border border-surface bg-main p-3 text-xs text-text whitespace-pre-wrap break-words max-h-56 overflow-y-auto">
              {task.outputTail?.trim() || "No output captured yet."}
            </pre>
          </div>

          {task.error && (
            <div className="px-3 py-2 rounded border border-red/30 bg-red/10 text-xs text-red break-words">
              {task.error}
            </div>
          )}

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-subtext mb-2">
              Phase timeline
            </h4>
            {phaseEvents.length === 0 ? (
              <div className="text-xs text-subtext">No phase updates available.</div>
            ) : (
              <div className="space-y-2">
                {phaseEvents.map((event, index) => (
                  <div key={`${event.atMs}-${event.phase}-${index}`} className="rounded border border-surface bg-main p-2">
                    <div className="text-xs text-text">{event.phase}</div>
                    <div className="mt-1 text-[11px] text-subtext">
                      {new Date(event.atMs).toLocaleTimeString()} • {formatRelativeAge(event.atMs, nowMs)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {task.kind === "automation_run" && task.target.tmuxSessionName && onAttachToAutomationSession && (
            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-surface">
              <button
                type="button"
                onClick={() => {
                  onAttachToAutomationSession(task);
                  onClose();
                }}
                className="px-3 py-1.5 text-xs rounded border border-accent/50 text-accent hover:bg-accent/10"
              >
                View Terminal
              </button>
              <span className="text-[11px] text-subtext">
                Attach to the agent's tmux session
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TaskCenterPagePresentational({
  runningTasks,
  recentTasks,
  focusedTaskId,
  onRetryTask,
  onViewTask,
  onAttachToAutomationSession,
  nowMs,
}: TaskCenterPagePresentationalProps) {
  const [inspectTaskId, setInspectTaskId] = useState<string | null>(null);
  const allTasksById = useMemo(() => {
    const map = new Map<string, BackgroundTask>();
    runningTasks.forEach((task) => {
      map.set(task.id, task);
    });
    recentTasks.forEach((task) => {
      map.set(task.id, task);
    });
    return map;
  }, [recentTasks, runningTasks]);
  const inspectedTask = inspectTaskId ? allTasksById.get(inspectTaskId) ?? null : null;

  return (
    <div className="h-full flex flex-col bg-main">
      <div className="px-5 py-4 border-b border-surface">
        <h2 className="text-lg font-semibold text-text">Task Center</h2>
        <p className="text-xs text-subtext">Live and recent background tasks</p>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-subtext mb-2">Running</h3>
          {runningTasks.length === 0 ? (
            <div className="text-xs text-subtext px-1 py-2">No active tasks</div>
          ) : (
            <div className="space-y-2">
              {runningTasks.map((task) => (
                <TaskCenterTaskCard
                  key={task.id}
                  task={task}
                  nowMs={nowMs}
                  focused={task.id === focusedTaskId}
                  onRetryTask={onRetryTask}
                  onViewTask={onViewTask}
                  onInspectTask={setInspectTaskId}
                />
              ))}
            </div>
          )}
        </section>

        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-subtext mb-2">Recent</h3>
          {recentTasks.length === 0 ? (
            <div className="text-xs text-subtext px-1 py-2">No completed tasks yet</div>
          ) : (
            <div className="space-y-2">
              {recentTasks.map((task) => (
                <TaskCenterTaskCard
                  key={task.id}
                  task={task}
                  nowMs={nowMs}
                  focused={task.id === focusedTaskId}
                  onRetryTask={onRetryTask}
                  onViewTask={onViewTask}
                  onInspectTask={setInspectTaskId}
                />
              ))}
            </div>
          )}
        </section>
      </div>
      {inspectedTask && (
        <TaskInspectModal
          task={inspectedTask}
          nowMs={nowMs}
          onClose={() => setInspectTaskId(null)}
          onAttachToAutomationSession={onAttachToAutomationSession}
        />
      )}
    </div>
  );
}

export default TaskCenterPagePresentational;
