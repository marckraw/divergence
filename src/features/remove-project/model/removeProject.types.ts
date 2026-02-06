import type { Divergence } from "../../../entities";
import type {
  BackgroundTaskControls,
  BackgroundTaskRunOptions,
  RunBackgroundTask,
} from "../../../entities/task";

export type RemoveProjectTaskControls = BackgroundTaskControls;
export type RemoveProjectTaskOptions<T> = BackgroundTaskRunOptions<T>;
export type RemoveProjectRunTask = RunBackgroundTask;

export interface ExecuteRemoveProjectParams {
  projectId: number;
  projectName: string;
  divergences: Divergence[];
  runTask: RemoveProjectRunTask;
  removeProject: (projectId: number) => Promise<void>;
  closeSessionsForProject: (projectId: number) => void;
  refreshDivergences: () => Promise<void>;
}
