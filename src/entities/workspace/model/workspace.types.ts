export interface Workspace {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  folderPath: string;
  createdAtMs: number;
  updatedAtMs: number;
}

export interface WorkspaceMember {
  id: number;
  workspaceId: number;
  projectId: number;
  addedAtMs: number;
}

export interface WorkspaceWithMembers extends Workspace {
  members: WorkspaceMember[];
}

export interface CreateWorkspaceInput {
  name: string;
  slug: string;
  description?: string | null;
  folderPath: string;
}

export interface UpdateWorkspaceInput {
  id: number;
  name?: string;
  description?: string | null;
}
