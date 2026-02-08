import type { Project } from "../../../entities";
import type {
  BackgroundTaskControls,
  BackgroundTaskRunOptions,
  RunBackgroundTask,
} from "../../../entities/task";

export type CreateDivergenceTaskControls = BackgroundTaskControls;
export type CreateDivergenceTaskOptions<T> = BackgroundTaskRunOptions<T>;
export type CreateDivergenceRunTask = RunBackgroundTask;

export interface ExecuteCreateDivergenceParams {
  project: Project;
  branchName: string;
  useExistingBranch: boolean;
  runTask: CreateDivergenceRunTask;
  refreshDivergences: () => Promise<void>;
}
