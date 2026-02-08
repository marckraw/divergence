import type { Project } from "../model/project.types";
import { getDb } from "../../../shared/api/database.api";

export async function listProjects(): Promise<Project[]> {
  const database = await getDb();
  return database.select<Project[]>("SELECT * FROM projects ORDER BY name");
}

export async function insertProject(name: string, path: string): Promise<void> {
  const database = await getDb();
  await database.execute(
    "INSERT INTO projects (name, path) VALUES (?, ?)",
    [name, path]
  );
}

export async function deleteProjectWithRelations(projectId: number): Promise<void> {
  const database = await getDb();
  await database.execute(
    "DELETE FROM divergences WHERE project_id = ?",
    [projectId]
  );
  await database.execute(
    "DELETE FROM project_settings WHERE project_id = ?",
    [projectId]
  );
  await database.execute("DELETE FROM projects WHERE id = ?", [projectId]);
}
