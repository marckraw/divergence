import type { Project, Workspace } from "../../../entities";
import {
  addWorkspaceMember,
  generateWorkspaceSlug,
  getWorkspace,
  insertWorkspaceAndGetId,
  listWorkspaceMembers,
  listWorkspaces,
} from "../../../entities/workspace";
import { createWorkspaceFolder, updateWorkspaceFolder } from "../../../shared/api/workspaceFolders.api";

interface EnsureAutomationWorkspaceInput {
  sourceProject: Project;
  targetProject: Project;
  allProjectsById: Map<number, Project>;
}

export async function ensureAutomationWorkspace({
  sourceProject,
  targetProject,
  allProjectsById,
}: EnsureAutomationWorkspaceInput): Promise<Workspace | null> {
  const slug = generateWorkspaceSlug(`auto-sync-${sourceProject.id}-${targetProject.id}`);
  const workspaceName = `Automation Sync: ${sourceProject.name} -> ${targetProject.name}`;
  const workspaceDescription = "Managed by event-driven automations.";
  const desiredProjects = uniqueProjects([sourceProject, targetProject]);

  const existingWorkspaces = await listWorkspaces();
  let workspace = existingWorkspaces.find((item) => item.slug === slug) ?? null;

  if (!workspace) {
    const folder = await createWorkspaceFolder(
      slug,
      workspaceName,
      desiredProjects.map((project) => ({ name: project.name, path: project.path })),
    );
    const workspaceId = await insertWorkspaceAndGetId({
      name: workspaceName,
      slug,
      description: workspaceDescription,
      folderPath: folder.folderPath,
    });
    for (const project of desiredProjects) {
      await addWorkspaceMember(workspaceId, project.id);
    }
    workspace = await getWorkspace(workspaceId);
    return workspace;
  }

  const currentMembers = await listWorkspaceMembers(workspace.id);
  const currentMemberProjectIds = new Set(currentMembers.map((member) => member.projectId));
  let membersChanged = false;

  for (const project of desiredProjects) {
    if (!currentMemberProjectIds.has(project.id)) {
      await addWorkspaceMember(workspace.id, project.id);
      currentMemberProjectIds.add(project.id);
      membersChanged = true;
    }
  }

  if (membersChanged) {
    const memberProjects = Array.from(currentMemberProjectIds)
      .map((projectId) => allProjectsById.get(projectId))
      .filter((project): project is Project => Boolean(project));

    await updateWorkspaceFolder(
      workspace.folderPath,
      workspace.name,
      memberProjects.map((project) => ({ name: project.name, path: project.path })),
    );
  }

  return workspace;
}

function uniqueProjects(projects: Project[]): Project[] {
  const byId = new Map<number, Project>();
  for (const project of projects) {
    byId.set(project.id, project);
  }
  return Array.from(byId.values());
}
