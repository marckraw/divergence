import type { RunBackgroundTask, WorkspaceDivergence } from "../../../entities";
import { deleteWorkspaceDivergence } from "../../../entities/workspace-divergence";
import { deleteWorkspaceFolder } from "../api/workspaceFolder.api";

export interface ExecuteDeleteWorkspaceDivergenceParams {
  workspaceDivergence: WorkspaceDivergence;
  runTask: RunBackgroundTask;
  closeSessionsForWorkspaceDivergence: (wdId: number) => void;
  refreshWorkspaces: () => Promise<void>;
}

export async function executeDeleteWorkspaceDivergence({
  workspaceDivergence,
  runTask,
  closeSessionsForWorkspaceDivergence,
  refreshWorkspaces,
}: ExecuteDeleteWorkspaceDivergenceParams): Promise<void> {
  return runTask<void>({
    kind: "delete_workspace_divergence",
    title: `Delete workspace divergence: ${workspaceDivergence.name}`,
    target: {
      type: "workspace",
      workspaceId: workspaceDivergence.workspaceId,
      label: workspaceDivergence.name,
    },
    origin: "workspace_divergence_delete",
    fsHeavy: true,
    initialPhase: "Queued",
    successMessage: `Deleted workspace divergence: ${workspaceDivergence.name}`,
    errorMessage: `Failed to delete workspace divergence: ${workspaceDivergence.name}`,
    run: async ({ setPhase }) => {
      setPhase("Closing sessions");
      closeSessionsForWorkspaceDivergence(workspaceDivergence.id);

      setPhase("Deleting folder");
      await deleteWorkspaceFolder(workspaceDivergence.folderPath);

      setPhase("Removing DB record");
      await deleteWorkspaceDivergence(workspaceDivergence.id);

      setPhase("Refreshing");
      await refreshWorkspaces();
    },
  });
}
