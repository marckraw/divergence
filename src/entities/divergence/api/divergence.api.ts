import { desc, eq } from "drizzle-orm";
import { db } from "../../../shared/api/drizzle.api";
import { divergences } from "../../../shared/api/schema";
import type { Divergence } from "../model/divergence.types";

export async function listDivergencesByProject(projectId: number): Promise<Divergence[]> {
  return db
    .select()
    .from(divergences)
    .where(eq(divergences.projectId, projectId))
    .orderBy(desc(divergences.createdAt));
}

export async function listAllDivergences(): Promise<Divergence[]> {
  return db.select().from(divergences).orderBy(desc(divergences.createdAt));
}

export async function insertDivergence(divergence: Omit<Divergence, "id">): Promise<void> {
  await db.insert(divergences).values(divergence);
}

export async function deleteDivergence(divergenceId: number): Promise<void> {
  await db.delete(divergences).where(eq(divergences.id, divergenceId));
}

export async function markDivergenceAsDiverged(divergenceId: number): Promise<void> {
  await db
    .update(divergences)
    .set({ hasDiverged: true })
    .where(eq(divergences.id, divergenceId));
}

export async function insertDivergenceAndGetId(divergence: Omit<Divergence, "id">): Promise<number> {
  const rows = await db
    .insert(divergences)
    .values(divergence)
    .returning({ id: divergences.id });
  return rows[0]?.id ?? 0;
}
