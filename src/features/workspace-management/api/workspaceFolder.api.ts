import { invoke } from "@tauri-apps/api/core";

interface WorkspaceProjectInput {
  name: string;
  path: string;
}

interface WorkspaceFolderResult {
  folderPath: string;
  claudeMdPath: string;
  agentsMdPath: string;
}

export async function createWorkspaceFolder(
  slug: string,
  workspaceName: string,
  projects: WorkspaceProjectInput[],
): Promise<WorkspaceFolderResult> {
  return invoke<WorkspaceFolderResult>("create_workspace_folder", {
    slug,
    workspaceName,
    projects,
  });
}

export async function updateWorkspaceFolder(
  folderPath: string,
  workspaceName: string,
  projects: WorkspaceProjectInput[],
): Promise<WorkspaceFolderResult> {
  return invoke<WorkspaceFolderResult>("update_workspace_folder", {
    folderPath,
    workspaceName,
    projects,
  });
}

export async function deleteWorkspaceFolder(folderPath: string): Promise<void> {
  return invoke<void>("delete_workspace_folder", { folderPath });
}

export async function getWorkspacesBasePath(): Promise<string> {
  return invoke<string>("get_workspaces_base_path");
}
