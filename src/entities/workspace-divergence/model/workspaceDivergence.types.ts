export interface WorkspaceDivergence {
  id: number;
  workspaceId: number;
  name: string;
  branch: string;
  folderPath: string;
  createdAtMs: number;
}

export interface InsertWorkspaceDivergenceInput {
  workspaceId: number;
  name: string;
  branch: string;
  folderPath: string;
}
