import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getRecentTasks,
  getRunningTasks,
  normalizeUnknownError,
  type BackgroundTask,
  type BackgroundTaskControls,
  type BackgroundTaskRunOptions,
  type BackgroundTaskToast,
  type RunBackgroundTask,
} from "../../../entities/task";

const DEFAULT_FS_CONCURRENCY = 2;
const SUCCESS_TOAST_TTL_MS = 5000;
const ERROR_TOAST_TTL_MS = 10000;
const MAX_TOASTS = 6;
const MAX_RECENT_TASKS = 30;
const FOCUS_TTL_MS = 4000;

interface QueueItem {
  fsHeavy: boolean;
  run: () => void;
}

interface UseTaskCenterResult {
  tasks: BackgroundTask[];
  runningTasks: BackgroundTask[];
  recentTasks: BackgroundTask[];
  toasts: BackgroundTaskToast[];
  runningCount: number;
  isDrawerOpen: boolean;
  focusedTaskId: string | null;
  openDrawer: () => void;
  closeDrawer: () => void;
  toggleDrawer: () => void;
  dismissToast: (toastId: string) => void;
  viewTask: (taskId: string) => void;
  retryTask: (taskId: string) => Promise<void>;
  runTask: RunBackgroundTask;
}

export function useTaskCenter(fsConcurrency: number = DEFAULT_FS_CONCURRENCY): UseTaskCenterResult {
  const [tasks, setTasks] = useState<BackgroundTask[]>([]);
  const [toasts, setToasts] = useState<BackgroundTaskToast[]>([]);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [focusedTaskId, setFocusedTaskId] = useState<string | null>(null);

  const fsQueueRef = useRef<QueueItem[]>([]);
  const normalQueueRef = useRef<QueueItem[]>([]);
  const runningFsCountRef = useRef(0);
  const retryHandlersRef = useRef<Map<string, () => Promise<void>>>(new Map());
  const toastTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const focusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const toastTimers = toastTimersRef.current;

    return () => {
      for (const timer of toastTimers.values()) {
        clearTimeout(timer);
      }
      toastTimers.clear();
      if (focusTimerRef.current) {
        clearTimeout(focusTimerRef.current);
      }
    };
  }, []);

  const updateTask = useCallback((taskId: string, updater: (task: BackgroundTask) => BackgroundTask) => {
    setTasks((previous) => previous.map((task) => (task.id === taskId ? updater(task) : task)));
  }, []);

  const dismissToast = useCallback((toastId: string) => {
    const timer = toastTimersRef.current.get(toastId);
    if (timer) {
      clearTimeout(timer);
      toastTimersRef.current.delete(toastId);
    }
    setToasts((previous) => previous.filter((toast) => toast.id !== toastId));
  }, []);

  const queueToast = useCallback((toast: Omit<BackgroundTaskToast, "id" | "createdAtMs">) => {
    const toastId = crypto.randomUUID();
    const createdAtMs = Date.now();
    const ttl = toast.kind === "error" ? ERROR_TOAST_TTL_MS : SUCCESS_TOAST_TTL_MS;

    setToasts((previous) => {
      const next = [...previous, { ...toast, id: toastId, createdAtMs }];
      if (next.length <= MAX_TOASTS) {
        return next;
      }
      const [evicted] = next;
      if (evicted) {
        const evictedTimer = toastTimersRef.current.get(evicted.id);
        if (evictedTimer) {
          clearTimeout(evictedTimer);
          toastTimersRef.current.delete(evicted.id);
        }
      }
      return next.slice(next.length - MAX_TOASTS);
    });

    const timer = setTimeout(() => {
      dismissToast(toastId);
    }, ttl);
    toastTimersRef.current.set(toastId, timer);
  }, [dismissToast]);

  const viewTask = useCallback((taskId: string) => {
    setIsDrawerOpen(true);
    setFocusedTaskId(taskId);
    if (focusTimerRef.current) {
      clearTimeout(focusTimerRef.current);
    }
    focusTimerRef.current = setTimeout(() => {
      setFocusedTaskId((current) => (current === taskId ? null : current));
      focusTimerRef.current = null;
    }, FOCUS_TTL_MS);
  }, []);

  const pumpQueue = useCallback(() => {
    while (normalQueueRef.current.length > 0) {
      const next = normalQueueRef.current.shift();
      if (!next) {
        break;
      }
      next.run();
    }

    while (runningFsCountRef.current < fsConcurrency && fsQueueRef.current.length > 0) {
      const next = fsQueueRef.current.shift();
      if (!next) {
        break;
      }
      runningFsCountRef.current += 1;
      next.run();
    }
  }, [fsConcurrency]);

  const enqueue = useCallback((item: QueueItem) => {
    if (item.fsHeavy) {
      fsQueueRef.current.push(item);
    } else {
      normalQueueRef.current.push(item);
    }
    pumpQueue();
  }, [pumpQueue]);

  const runTask = useCallback(<T,>(options: BackgroundTaskRunOptions<T>): Promise<T> => {
    const taskId = crypto.randomUUID();
    const createdAtMs = Date.now();
    const initialPhase = options.initialPhase ?? "Queued";

    const queuedTask: BackgroundTask = {
      id: taskId,
      kind: options.kind,
      status: "queued",
      title: options.title,
      phase: initialPhase,
      fsHeavy: options.fsHeavy,
      retryable: false,
      origin: options.origin,
      target: options.target,
      createdAtMs,
    };

    setTasks((previous) => {
      const combined = [...previous, queuedTask];
      if (combined.length <= MAX_RECENT_TASKS + 20) {
        return combined;
      }
      return combined.slice(combined.length - (MAX_RECENT_TASKS + 20));
    });

    const retry = async (): Promise<void> => {
      await runTask(options);
    };
    retryHandlersRef.current.set(taskId, retry);

    return new Promise<T>((resolve, reject) => {
      const execute = () => {
        updateTask(taskId, (task) => ({
          ...task,
          status: "running",
          startedAtMs: Date.now(),
          phase: options.initialPhase ?? "Starting",
          progress: undefined,
          error: undefined,
          retryable: false,
        }));

        const controls: BackgroundTaskControls = {
          setPhase: (phase: string, progress?: number) => {
            updateTask(taskId, (task) => ({ ...task, phase, progress }));
          },
        };

        options
          .run(controls)
          .then((result) => {
            updateTask(taskId, (task) => ({
              ...task,
              status: "success",
              phase: "Done",
              endedAtMs: Date.now(),
              progress: 100,
              retryable: false,
            }));
            retryHandlersRef.current.delete(taskId);
            queueToast({
              taskId,
              kind: "success",
              message: options.successMessage ?? `${options.title} completed`,
            });
            resolve(result);
          })
          .catch((error: unknown) => {
            const normalized = normalizeUnknownError(error);
            updateTask(taskId, (task) => ({
              ...task,
              status: "error",
              phase: "Failed",
              endedAtMs: Date.now(),
              error: options.errorMessage ?? normalized.message,
              retryable: true,
            }));
            setIsDrawerOpen(true);
            queueToast({
              taskId,
              kind: "error",
              message: options.errorMessage ?? `${options.title} failed`,
            });
            reject(normalized);
          })
          .finally(() => {
            if (options.fsHeavy) {
              runningFsCountRef.current = Math.max(0, runningFsCountRef.current - 1);
            }
            pumpQueue();
          });
      };

      enqueue({
        fsHeavy: options.fsHeavy,
        run: execute,
      });
    });
  }, [enqueue, pumpQueue, queueToast, updateTask]);

  const retryTask = useCallback(async (taskId: string) => {
    const handler = retryHandlersRef.current.get(taskId);
    if (!handler) {
      return;
    }
    await handler();
  }, []);

  const runningTasks = useMemo(() => {
    return getRunningTasks(tasks);
  }, [tasks]);

  const recentTasks = useMemo(() => {
    return getRecentTasks(tasks, MAX_RECENT_TASKS);
  }, [tasks]);

  const runningCount = runningTasks.length;

  const openDrawer = useCallback(() => {
    setIsDrawerOpen(true);
  }, []);

  const closeDrawer = useCallback(() => {
    setIsDrawerOpen(false);
  }, []);

  const toggleDrawer = useCallback(() => {
    setIsDrawerOpen((current) => !current);
  }, []);

  return {
    tasks,
    runningTasks,
    recentTasks,
    toasts,
    runningCount,
    isDrawerOpen,
    focusedTaskId,
    openDrawer,
    closeDrawer,
    toggleDrawer,
    dismissToast,
    viewTask,
    retryTask,
    runTask,
  };
}
