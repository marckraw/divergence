import { invoke } from "@tauri-apps/api/core";
import { eq } from "drizzle-orm";
import { db } from "../../../shared/api/drizzle.api";
import { projects } from "../../../shared/api/schema.types";
import type { Project } from "../model/project.types";

async function listProjectsViaCommand(): Promise<Project[]> {
  return invoke<Project[]>("list_projects");
}

export async function listProjects(): Promise<Project[]> {
  try {
    const result = await db.select().from(projects).orderBy(projects.name);
    if (result.length > 0) {
      return result;
    }

    const fallback = await listProjectsViaCommand();
    return fallback.length > 0 ? fallback : result;
  } catch (error) {
    console.warn("Failed to list projects via plugin-sql. Falling back to Rust command.", error);
    return listProjectsViaCommand();
  }
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
