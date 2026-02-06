import type { Divergence } from "../model/divergence.types";
import { getDb } from "../../../shared/api/database.api";

export async function listDivergencesByProject(projectId: number): Promise<Divergence[]> {
  const database = await getDb();
  return database.select<Divergence[]>(
    "SELECT * FROM divergences WHERE project_id = ? ORDER BY created_at DESC",
    [projectId]
  );
}

export async function listAllDivergences(): Promise<Divergence[]> {
  const database = await getDb();
  return database.select<Divergence[]>(
    "SELECT * FROM divergences ORDER BY created_at DESC"
  );
}

export async function insertDivergence(divergence: Omit<Divergence, "id">): Promise<void> {
  const database = await getDb();
  await database.execute(
    "INSERT INTO divergences (project_id, name, branch, path, created_at, has_diverged) VALUES (?, ?, ?, ?, ?, ?)",
    [
      divergence.project_id,
      divergence.name,
      divergence.branch,
      divergence.path,
      divergence.created_at,
      divergence.has_diverged ?? 0,
    ]
  );
}

export async function deleteDivergence(divergenceId: number): Promise<void> {
  const database = await getDb();
  await database.execute("DELETE FROM divergences WHERE id = ?", [divergenceId]);
}

export async function markDivergenceAsDiverged(divergenceId: number): Promise<void> {
  const database = await getDb();
  await database.execute("UPDATE divergences SET has_diverged = 1 WHERE id = ?", [divergenceId]);
}

export async function insertDivergenceAndGetId(divergence: Omit<Divergence, "id">): Promise<number> {
  const database = await getDb();
  await database.execute(
    "INSERT INTO divergences (project_id, name, branch, path, created_at, has_diverged) VALUES (?, ?, ?, ?, ?, ?)",
    [
      divergence.project_id,
      divergence.name,
      divergence.branch,
      divergence.path,
      divergence.created_at,
      divergence.has_diverged ?? 0,
    ]
  );
  const rows = await database.select<{ id: number }[]>("SELECT last_insert_rowid() as id");
  return rows[0]?.id ?? 0;
}
