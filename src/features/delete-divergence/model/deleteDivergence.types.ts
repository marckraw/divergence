import type { Divergence, RunBackgroundTask } from "../../../entities";

export interface DeleteDivergenceParams {
  divergence: Divergence;
  origin: string;
  projectName: string;
  runTask: RunBackgroundTask;
  closeSessionsForDivergence: (divergenceId: number) => void;
  refreshDivergences: () => Promise<void>;
}
