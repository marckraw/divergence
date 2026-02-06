import type { BackgroundTask } from "../../../entities/task";

export interface TaskCenterDrawerProps {
  isOpen: boolean;
  runningCount: number;
  runningTasks: BackgroundTask[];
  recentTasks: BackgroundTask[];
  focusedTaskId: string | null;
  onClose: () => void;
  onRetryTask: (taskId: string) => Promise<void>;
}
