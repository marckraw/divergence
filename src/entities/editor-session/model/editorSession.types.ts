export interface EditorSession {
  id: string;
  kind: "editor";
  targetType: "project" | "divergence" | "workspace" | "workspace_divergence";
  targetId: number;
  projectId: number;
  workspaceOwnerId?: number;
  workspaceKey: string;
  name: string;
  path: string;
  filePath: string;
  status: "idle" | "active";
  createdAtMs: number;
}
