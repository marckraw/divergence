import { desc, eq } from "drizzle-orm";
import { db } from "../../../shared/api/drizzle.api";
import { workspaceDivergences } from "../../../shared/api/schema.types";
import type {
  InsertWorkspaceDivergenceInput,
  WorkspaceDivergence,
} from "../model/workspaceDivergence.types";

export async function listWorkspaceDivergences(): Promise<WorkspaceDivergence[]> {
  return db
    .select()
    .from(workspaceDivergences)
    .orderBy(desc(workspaceDivergences.createdAtMs));
}

export async function listWorkspaceDivergencesForWorkspace(
  workspaceId: number,
): Promise<WorkspaceDivergence[]> {
  return db
    .select()
    .from(workspaceDivergences)
    .where(eq(workspaceDivergences.workspaceId, workspaceId))
    .orderBy(desc(workspaceDivergences.createdAtMs));
}

export async function insertWorkspaceDivergenceAndGetId(
  input: InsertWorkspaceDivergenceInput,
): Promise<number> {
  const nowMs = Date.now();
  const rows = await db
    .insert(workspaceDivergences)
    .values({
      workspaceId: input.workspaceId,
      name: input.name,
      branch: input.branch,
      folderPath: input.folderPath,
      createdAtMs: nowMs,
    })
    .returning({ id: workspaceDivergences.id });

  return rows[0]?.id ?? 0;
}

export async function deleteWorkspaceDivergence(id: number): Promise<void> {
  await db
    .delete(workspaceDivergences)
    .where(eq(workspaceDivergences.id, id));
}
