import { useCallback, useEffect, useMemo, useState } from "react";
import TaskCenterPagePresentational from "./TaskCenterPage.presentational";
import type { TaskCenterPageProps } from "./TaskCenterPage.types";

function TaskCenterPageContainer({
  runningTasks,
  recentTasks,
  onRetryTask,
  ...props
}: TaskCenterPageProps) {
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [inspectTaskId, setInspectTaskId] = useState<string | null>(null);
  const [retryingTaskId, setRetryingTaskId] = useState<string | null>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => {
      clearInterval(timer);
    };
  }, []);

  const knownTaskIds = useMemo(() => {
    const ids = new Set<string>();
    runningTasks.forEach((task) => ids.add(task.id));
    recentTasks.forEach((task) => ids.add(task.id));
    return ids;
  }, [recentTasks, runningTasks]);

  useEffect(() => {
    if (!inspectTaskId) {
      return;
    }
    if (!knownTaskIds.has(inspectTaskId)) {
      setInspectTaskId(null);
    }
  }, [inspectTaskId, knownTaskIds]);

  const handleRetryTask = useCallback(async (taskId: string) => {
    if (retryingTaskId) {
      return;
    }
    setRetryingTaskId(taskId);
    try {
      await onRetryTask(taskId);
    } finally {
      setRetryingTaskId((current) => (current === taskId ? null : current));
    }
  }, [onRetryTask, retryingTaskId]);

  return (
    <TaskCenterPagePresentational
      {...props}
      runningTasks={runningTasks}
      recentTasks={recentTasks}
      onRetryTask={handleRetryTask}
      inspectTaskId={inspectTaskId}
      retryingTaskId={retryingTaskId}
      onInspectTask={setInspectTaskId}
      onCloseInspectTask={() => setInspectTaskId(null)}
      nowMs={nowMs}
    />
  );
}

export default TaskCenterPageContainer;
