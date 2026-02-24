import type { Divergence, RunBackgroundTask } from "../../../entities";

export interface ExecuteRemoveProjectParams {
  projectId: number;
  projectName: string;
  divergences: Divergence[];
  runTask: RunBackgroundTask;
  removeProject: (projectId: number) => Promise<void>;
  closeSessionsForProject: (projectId: number) => void;
  refreshDivergences: () => Promise<void>;
}
