import type { Divergence } from "../../../entities";
import type {
  BackgroundTaskControls,
  BackgroundTaskRunOptions,
  RunBackgroundTask,
} from "../../../entities/task";

export type DeleteDivergenceTaskControls = BackgroundTaskControls;
export type DeleteDivergenceTaskOptions<T> = BackgroundTaskRunOptions<T>;
export type DeleteDivergenceRunTask = RunBackgroundTask;

export interface DeleteDivergenceParams {
  divergence: Divergence;
  origin: string;
  projectName: string;
  runTask: DeleteDivergenceRunTask;
  closeSessionsForDivergence: (divergenceId: number) => void;
  refreshDivergences: () => Promise<void>;
}
