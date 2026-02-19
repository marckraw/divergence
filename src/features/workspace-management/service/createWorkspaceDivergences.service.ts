import type { Project, RunBackgroundTask, Workspace } from "../../../entities";
import { loadProjectSettings } from "../../../entities/project";
import { generateWorkspaceSlug } from "../../../entities/workspace";
import { insertWorkspaceDivergenceAndGetId } from "../../../entities/workspace-divergence";
import {
  createDivergenceRepository,
  insertDivergenceRecord,
} from "../../create-divergence/api/createDivergence.api";
import { createWorkspaceFolder } from "../api/workspaceFolder.api";

interface CreatedDivergenceInfo {
  name: string;
  path: string;
}

export interface ExecuteCreateWorkspaceDivergencesParams {
  workspace: Workspace;
  memberProjects: Project[];
  branchName: string;
  useExistingBranch: boolean;
  runTask: RunBackgroundTask;
  refreshDivergences: () => Promise<void>;
  refreshWorkspaces: () => Promise<void>;
}

export async function executeCreateWorkspaceDivergences({
  workspace,
  memberProjects,
  branchName,
  useExistingBranch,
  runTask,
  refreshDivergences,
  refreshWorkspaces,
}: ExecuteCreateWorkspaceDivergencesParams): Promise<void> {
  const total = memberProjects.length;

  return runTask<void>({
    kind: "create_workspace_divergences",
    title: `Create divergences for workspace: ${workspace.name}`,
    target: {
      type: "workspace",
      workspaceId: workspace.id,
      label: `${workspace.name} / ${branchName}`,
    },
    origin: "workspace_divergence_modal",
    fsHeavy: true,
    initialPhase: "Queued",
    successMessage: `Created divergences for ${total} projects + workspace divergence`,
    errorMessage: `Failed to create workspace divergences`,
    run: async ({ setPhase }) => {
      const createdDivergences: CreatedDivergenceInfo[] = [];

      for (let i = 0; i < memberProjects.length; i++) {
        const project = memberProjects[i];
        setPhase(`Creating divergence for ${project.name} (${i + 1}/${total})`);

        const settings = await loadProjectSettings(project.id);

        const divergence = await createDivergenceRepository({
          project,
          branchName,
          copyIgnoredSkip: settings.copyIgnoredSkip,
          useExistingBranch,
        });

        await insertDivergenceRecord(divergence);
        createdDivergences.push({ name: divergence.name, path: divergence.path });
      }

      // Create the workspace divergence folder with symlinks to divergence paths
      const branchSlug = generateWorkspaceSlug(branchName);
      const wsDivSlug = `${workspace.slug}--${branchSlug}`;
      const wsDivName = `${workspace.name} (${branchName})`;

      setPhase("Creating workspace divergence folder");
      const folderResult = await createWorkspaceFolder(
        wsDivSlug,
        wsDivName,
        createdDivergences,
      );

      setPhase("Saving workspace divergence record");
      await insertWorkspaceDivergenceAndGetId({
        workspaceId: workspace.id,
        name: wsDivSlug,
        branch: branchName,
        folderPath: folderResult.folderPath,
      });

      setPhase("Refreshing");
      await refreshDivergences();
      await refreshWorkspaces();
    },
  });
}
