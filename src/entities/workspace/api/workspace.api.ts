import { and, desc, eq } from "drizzle-orm";
import { db } from "../../../shared/api/drizzle.api";
import { workspaceMembers, workspaces } from "../../../shared/api/schema.types";
import type {
  CreateWorkspaceInput,
  UpdateWorkspaceInput,
  Workspace,
  WorkspaceMember,
} from "../model/workspace.types";

export async function listWorkspaces(): Promise<Workspace[]> {
  return db.select().from(workspaces).orderBy(desc(workspaces.updatedAtMs));
}

export async function getWorkspace(workspaceId: number): Promise<Workspace | null> {
  const rows = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);
  return rows[0] ?? null;
}

export async function insertWorkspaceAndGetId(input: CreateWorkspaceInput): Promise<number> {
  const nowMs = Date.now();
  const rows = await db
    .insert(workspaces)
    .values({
      name: input.name,
      slug: input.slug,
      description: input.description ?? null,
      folderPath: input.folderPath,
      createdAtMs: nowMs,
      updatedAtMs: nowMs,
    })
    .returning({ id: workspaces.id });

  return rows[0]?.id ?? 0;
}

export async function updateWorkspace(input: UpdateWorkspaceInput): Promise<void> {
  const nowMs = Date.now();
  const fields: Record<string, unknown> = { updatedAtMs: nowMs };
  if (input.name !== undefined) fields.name = input.name;
  if (input.description !== undefined) fields.description = input.description;

  await db
    .update(workspaces)
    .set(fields)
    .where(eq(workspaces.id, input.id));
}

export async function deleteWorkspaceWithRelations(workspaceId: number): Promise<void> {
  // workspaceMembers and workspaceDivergences have ON DELETE CASCADE,
  // so deleting the workspace row handles child cleanup automatically.
  await db.delete(workspaces).where(eq(workspaces.id, workspaceId));
}

export async function listWorkspaceMembers(workspaceId: number): Promise<WorkspaceMember[]> {
  return db
    .select()
    .from(workspaceMembers)
    .where(eq(workspaceMembers.workspaceId, workspaceId));
}

export async function addWorkspaceMember(
  workspaceId: number,
  projectId: number,
): Promise<void> {
  const nowMs = Date.now();
  await db
    .insert(workspaceMembers)
    .values({
      workspaceId,
      projectId,
      addedAtMs: nowMs,
    });
}

export async function removeWorkspaceMember(
  workspaceId: number,
  projectId: number,
): Promise<void> {
  await db
    .delete(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, workspaceId),
        eq(workspaceMembers.projectId, projectId),
      ),
    );
}

export async function listWorkspacesForProject(projectId: number): Promise<Workspace[]> {
  const memberRows = await db
    .select({ workspaceId: workspaceMembers.workspaceId })
    .from(workspaceMembers)
    .where(eq(workspaceMembers.projectId, projectId));

  if (memberRows.length === 0) {
    return [];
  }

  const workspaceIds = memberRows.map((row) => row.workspaceId);
  const results: Workspace[] = [];
  for (const wsId of workspaceIds) {
    const ws = await getWorkspace(wsId);
    if (ws) results.push(ws);
  }
  return results;
}
