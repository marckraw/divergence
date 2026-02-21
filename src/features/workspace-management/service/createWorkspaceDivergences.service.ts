import type { Project, RunBackgroundTask, Workspace } from "../../../entities";
import { loadProjectSettings } from "../../../entities/project";
import { generateWorkspaceSlug } from "../../../entities/workspace";
import { insertWorkspaceDivergenceAndGetId } from "../../../entities/workspace-divergence";
import {
  allocatePort,
  detectFrameworkForPath,
  getAdapterById,
} from "../../../entities/port-management";
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
  refreshPortAllocations?: () => void;
}

export async function executeCreateWorkspaceDivergences({
  workspace,
  memberProjects,
  branchName,
  useExistingBranch,
  runTask,
  refreshDivergences,
  refreshWorkspaces,
  refreshPortAllocations,
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

        const insertedId = await insertDivergenceRecord(divergence);
        createdDivergences.push({ name: divergence.name, path: divergence.path });

        // Allocate port for each divergence (non-fatal)
        try {
          const detectedFramework = settings.framework
            ? getAdapterById(settings.framework)
            : await detectFrameworkForPath(divergence.path);
          const preferredPort = settings.defaultPort ?? detectedFramework?.defaultPort;
          await allocatePort({
            entityType: "divergence",
            entityId: insertedId,
            projectId: project.id,
            framework: detectedFramework?.id ?? null,
            preferredPort,
          });
        } catch (err) {
          console.warn(`Port allocation failed for ${divergence.name} (non-fatal):`, err);
        }
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
      const wsDivId = await insertWorkspaceDivergenceAndGetId({
        workspaceId: workspace.id,
        name: wsDivSlug,
        branch: branchName,
        folderPath: folderResult.folderPath,
      });

      // Allocate port for workspace divergence (non-fatal)
      try {
        await allocatePort({
          entityType: "workspace_divergence",
          entityId: wsDivId,
          projectId: null,
          framework: null,
        });
      } catch (err) {
        console.warn("Port allocation for workspace divergence failed (non-fatal):", err);
      }

      setPhase("Refreshing");
      await refreshDivergences();
      await refreshWorkspaces();
      refreshPortAllocations?.();
    },
  });
}
