import { killDivergenceTmuxSessions } from "../../../shared/api/tmuxSessions.api";
import {
  deleteDivergenceFiles,
  deleteDivergenceRecord,
} from "../api/deleteDivergence.api";
import type { DeleteDivergenceParams } from "../model/deleteDivergence.types";

export async function executeDeleteDivergence({
  divergence,
  origin,
  projectName,
  runTask,
  closeSessionsForDivergence,
  refreshDivergences,
}: DeleteDivergenceParams): Promise<void> {
  await runTask<void>({
    kind: "delete_divergence",
    title: `Delete divergence: ${divergence.branch}`,
    target: {
      type: "divergence",
      projectId: divergence.project_id,
      divergenceId: divergence.id,
      projectName,
      branch: divergence.branch,
      path: divergence.path,
      label: `${projectName} / ${divergence.branch}`,
    },
    origin,
    fsHeavy: true,
    initialPhase: "Queued",
    successMessage: `Deleted divergence: ${divergence.branch}`,
    errorMessage: `Failed to delete divergence: ${divergence.branch}`,
    run: async ({ setPhase }) => {
      setPhase("Deleting local files");
      await deleteDivergenceFiles(divergence.path);

      setPhase("Closing terminal sessions");
      await killDivergenceTmuxSessions(divergence, projectName);

      setPhase("Closing open tabs");
      closeSessionsForDivergence(divergence.id);

      setPhase("Removing database record");
      await deleteDivergenceRecord(divergence.id);

      setPhase("Refreshing divergences");
      await refreshDivergences();
    },
  });
}
