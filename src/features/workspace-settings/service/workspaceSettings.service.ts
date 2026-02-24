import type { Project } from "../../../entities";
import {
  addWorkspaceMember,
  getWorkspace,
  listWorkspaceMembers,
  removeWorkspaceMember,
  saveWorkspaceSettings,
  updateWorkspace,
} from "../../../entities/workspace";
import { updateWorkspaceFolder } from "../../../shared/api/workspaceFolders.api";

export async function updateWorkspaceMembers(
  workspaceId: number,
  projectIdsToAdd: number[],
  projectIdsToRemove: number[],
  allProjects: Project[],
): Promise<void> {
  for (const projectId of projectIdsToRemove) {
    await removeWorkspaceMember(workspaceId, projectId);
  }
  for (const projectId of projectIdsToAdd) {
    await addWorkspaceMember(workspaceId, projectId);
  }

  // Regenerate workspace folder symlinks and agent files
  const workspace = await getWorkspace(workspaceId);
  if (!workspace) return;

  const members = await listWorkspaceMembers(workspaceId);
  const memberProjectIds = new Set(members.map((m) => m.projectId));
  const memberProjects = allProjects.filter((p) => memberProjectIds.has(p.id));

  await updateWorkspaceFolder(
    workspace.folderPath,
    workspace.name,
    memberProjects.map((p) => ({ name: p.name, path: p.path })),
  );
}

interface SaveWorkspaceConfigurationInput {
  workspaceId: number;
  name: string;
  description: string | null;
  defaultPort: number | null;
  framework: string | null;
}

export async function saveWorkspaceConfiguration({
  workspaceId,
  name,
  description,
  defaultPort,
  framework,
}: SaveWorkspaceConfigurationInput): Promise<void> {
  await updateWorkspace({ id: workspaceId, name, description });
  await saveWorkspaceSettings(workspaceId, defaultPort, framework);
}
