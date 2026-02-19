import type { RunBackgroundTask, Workspace } from "../../../entities";
import { deleteWorkspaceWithRelations } from "../../../entities/workspace";
import { listWorkspaceDivergencesForWorkspace } from "../../../entities/workspace-divergence";
import { deleteWorkspaceFolder } from "../api/workspaceFolder.api";

export interface ExecuteDeleteWorkspaceParams {
  workspace: Workspace;
  runTask: RunBackgroundTask;
  closeSessionsForWorkspace: (workspaceId: number) => void;
  closeSessionsForWorkspaceDivergence: (wdId: number) => void;
  refreshWorkspaces: () => Promise<void>;
}

export async function executeDeleteWorkspace({
  workspace,
  runTask,
  closeSessionsForWorkspace,
  closeSessionsForWorkspaceDivergence,
  refreshWorkspaces,
}: ExecuteDeleteWorkspaceParams): Promise<void> {
  return runTask<void>({
    kind: "delete_workspace",
    title: `Delete workspace: ${workspace.name}`,
    target: {
      type: "workspace",
      workspaceId: workspace.id,
      label: workspace.name,
    },
    origin: "workspace_delete",
    fsHeavy: true,
    initialPhase: "Queued",
    successMessage: `Deleted workspace: ${workspace.name}`,
    errorMessage: `Failed to delete workspace: ${workspace.name}`,
    run: async ({ setPhase }) => {
      setPhase("Closing sessions");
      closeSessionsForWorkspace(workspace.id);

      // Delete workspace divergence folders (DB cascade handles records, but not disk)
      const wsDivergences = await listWorkspaceDivergencesForWorkspace(workspace.id);
      for (const wd of wsDivergences) {
        closeSessionsForWorkspaceDivergence(wd.id);
        setPhase(`Deleting workspace divergence folder: ${wd.name}`);
        try {
          await deleteWorkspaceFolder(wd.folderPath);
        } catch (err) {
          console.warn(`Failed to delete workspace divergence folder ${wd.folderPath}:`, err);
        }
      }

      setPhase("Deleting folder");
      await deleteWorkspaceFolder(workspace.folderPath);

      setPhase("Removing DB record");
      await deleteWorkspaceWithRelations(workspace.id);

      setPhase("Refreshing");
      await refreshWorkspaces();
    },
  });
}
