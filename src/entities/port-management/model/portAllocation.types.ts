export type PortEntityType = "project" | "divergence" | "workspace_divergence";

export interface PortAllocation {
  id: number;
  entityType: PortEntityType;
  entityId: number;
  projectId: number | null;
  port: number;
  framework: string | null;
  proxyHostname: string | null;
  createdAtMs: number;
}

export interface AllocatePortInput {
  entityType: PortEntityType;
  entityId: number;
  projectId: number | null;
  framework: string | null;
  preferredPort?: number;
}
