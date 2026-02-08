import { useState } from "react";
import {
  formatElapsed,
  getTaskStatusClass,
  getTaskStatusLabel,
  type BackgroundTask,
} from "../../../entities/task";
import type { TaskCenterDrawerProps } from "./TaskCenterDrawer.types";

interface TaskCenterDrawerPresentationalProps extends TaskCenterDrawerProps {
  nowMs: number;
}

interface TaskCardProps {
  task: BackgroundTask;
  nowMs: number;
  focused: boolean;
  onRetryTask: (taskId: string) => Promise<void>;
}

function TaskCard({
  task,
  nowMs,
  focused,
  onRetryTask,
}: TaskCardProps) {
  const [isRetrying, setIsRetrying] = useState(false);

  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      await onRetryTask(task.id);
    } finally {
      setIsRetrying(false);
    }
  };

  return (
    <div
      className={`rounded-md border p-3 ${
        focused ? "border-accent bg-accent/10" : "border-surface bg-main/50"
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

      {typeof task.progress === "number" && task.status === "running" && (
        <div className="mt-2 h-1.5 bg-surface rounded-full overflow-hidden">
          <div className="h-full bg-accent transition-all" style={{ width: `${task.progress}%` }} />
        </div>
      )}

      {task.error && task.status === "error" && (
        <div className="mt-2 text-xs text-red break-words">{task.error}</div>
      )}

      {task.status === "error" && task.retryable && (
        <div className="mt-3 flex justify-end">
          <button
            onClick={handleRetry}
            disabled={isRetrying}
            className="px-2 py-1 text-xs rounded border border-surface text-text hover:bg-surface disabled:opacity-60"
          >
            {isRetrying ? "Retrying..." : "Retry"}
          </button>
        </div>
      )}
    </div>
  );
}

function TaskCenterDrawerPresentational({
  isOpen,
  runningCount,
  runningTasks,
  recentTasks,
  focusedTaskId,
  onClose,
  onRetryTask,
  nowMs,
}: TaskCenterDrawerPresentationalProps) {
  return (
    <div
      className={`fixed top-0 right-0 h-full w-96 z-40 border-l border-surface bg-sidebar shadow-2xl transition-transform duration-200 ease-out ${
        isOpen ? "translate-x-0" : "translate-x-full"
      }`}
    >
      <div className="h-full flex flex-col">
        <div className="px-4 py-3 border-b border-surface flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-text">Task Center</h2>
            <p className="text-xs text-subtext">Running: {runningCount}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-subtext hover:text-text hover:bg-surface"
            aria-label="Close task center"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-subtext mb-2">Running</h3>
            {runningTasks.length === 0 ? (
              <div className="text-xs text-subtext px-1 py-2">No active tasks</div>
            ) : (
              <div className="space-y-2">
                {runningTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    nowMs={nowMs}
                    focused={task.id === focusedTaskId}
                    onRetryTask={onRetryTask}
                  />
                ))}
              </div>
            )}
          </section>

          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-subtext mb-2">Recent</h3>
            {recentTasks.length === 0 ? (
              <div className="text-xs text-subtext px-1 py-2">No completed tasks in this session</div>
            ) : (
              <div className="space-y-2">
                {recentTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    nowMs={nowMs}
                    focused={task.id === focusedTaskId}
                    onRetryTask={onRetryTask}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

export default TaskCenterDrawerPresentational;
