import type { Project, RunBackgroundTask } from "../../../entities";

export interface ExecuteCreateDivergenceParams {
  project: Project;
  branchName: string;
  useExistingBranch: boolean;
  runTask: RunBackgroundTask;
  refreshDivergences: () => Promise<void>;
  refreshPortAllocations?: () => void;
}
