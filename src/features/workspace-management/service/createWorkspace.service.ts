import type { Project, RunBackgroundTask } from "../../../entities";
import {
  addWorkspaceMember,
  insertWorkspaceAndGetId,
} from "../../../entities/workspace";
import { generateWorkspaceSlug } from "../../../entities/workspace";
import { createWorkspaceFolder } from "../api/workspaceFolder.api";

export interface ExecuteCreateWorkspaceParams {
  name: string;
  description?: string;
  selectedProjects: Project[];
  runTask: RunBackgroundTask;
  refreshWorkspaces: () => Promise<void>;
}

export async function executeCreateWorkspace({
  name,
  description,
  selectedProjects,
  runTask,
  refreshWorkspaces,
}: ExecuteCreateWorkspaceParams): Promise<number> {
  const slug = generateWorkspaceSlug(name);

  return runTask<number>({
    kind: "create_workspace",
    title: `Create workspace: ${name}`,
    target: {
      type: "workspace",
      label: name,
    },
    origin: "create_workspace_modal",
    fsHeavy: true,
    initialPhase: "Queued",
    successMessage: `Created workspace: ${name}`,
    errorMessage: `Failed to create workspace: ${name}`,
    run: async ({ setPhase }) => {
      setPhase("Creating workspace folder");
      const projects = selectedProjects.map((p) => ({ name: p.name, path: p.path }));
      const result = await createWorkspaceFolder(slug, name, projects);

      setPhase("Saving workspace record");
      const workspaceId = await insertWorkspaceAndGetId({
        name,
        slug,
        description: description ?? null,
        folderPath: result.folderPath,
      });

      setPhase("Adding project members");
      for (const project of selectedProjects) {
        await addWorkspaceMember(workspaceId, project.id);
      }

      setPhase("Refreshing");
      await refreshWorkspaces();
      return workspaceId;
    },
  });
}
