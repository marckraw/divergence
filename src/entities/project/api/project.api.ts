import { eq } from "drizzle-orm";
import { db } from "../../../shared/api/drizzle.api";
import { projects } from "../../../shared/api/schema.types";
import type { Project } from "../model/project.types";

export async function listProjects(): Promise<Project[]> {
  return db.select().from(projects).orderBy(projects.name);
}

export async function insertProject(name: string, path: string): Promise<void> {
  await db.insert(projects).values({ name, path });
}

export async function deleteProjectWithRelations(projectId: number): Promise<void> {
  // All child tables (divergences, projectSettings, automations, workspaceMembers)
  // have ON DELETE CASCADE, so deleting the project row handles everything.
  // Avoid db.transaction() — the sqlite-proxy driver sends BEGIN/COMMIT as
  // separate statements which can land on different pooled connections.
  await db.delete(projects).where(eq(projects.id, projectId));
}
