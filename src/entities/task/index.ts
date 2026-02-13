export type {
  BackgroundTask,
  BackgroundTaskControls,
  BackgroundTaskPhaseEvent,
  BackgroundTaskKind,
  BackgroundTaskRunOptions,
  BackgroundTaskStatus,
  BackgroundTaskTarget,
  BackgroundTaskToast,
  RunBackgroundTask,
} from "./model/task.types";

export type {
  AutomationRunHydrationInput,
  AutomationHydrationLookup,
  ProjectHydrationLookup,
} from "./lib/taskCenter.pure";

export {
  automationRunToBackgroundTask,
  hydrateTasksFromAutomationRuns,
  formatElapsed,
  getRecentTasks,
  getRunningTasks,
  getTaskStatusClass,
  getTaskStatusLabel,
  normalizeUnknownError,
} from "./lib/taskCenter.pure";
