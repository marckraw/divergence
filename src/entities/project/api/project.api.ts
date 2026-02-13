import { eq } from "drizzle-orm";
import { db } from "../../../shared/api/drizzle.api";
import { divergences, projects, projectSettings } from "../../../shared/api/schema.types";
import type { Project } from "../model/project.types";

export async function listProjects(): Promise<Project[]> {
  return db.select().from(projects).orderBy(projects.name);
}

export async function insertProject(name: string, path: string): Promise<void> {
  await db.insert(projects).values({ name, path });
}

export async function deleteProjectWithRelations(projectId: number): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(divergences).where(eq(divergences.projectId, projectId));
    await tx.delete(projectSettings).where(eq(projectSettings.projectId, projectId));
    await tx.delete(projects).where(eq(projects.id, projectId));
  });
}
