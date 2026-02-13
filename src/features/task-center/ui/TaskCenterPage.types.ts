import type { BackgroundTask } from "../../../entities/task";

export interface TaskCenterPageProps {
  runningTasks: BackgroundTask[];
  recentTasks: BackgroundTask[];
  focusedTaskId: string | null;
  onRetryTask: (taskId: string) => Promise<void>;
  onViewTask: (taskId: string) => void;
  onDismissTask: (taskId: string) => void;
  onDismissAllRecentTasks: () => void;
  onAttachToAutomationSession?: (task: BackgroundTask) => void;
}
