import { eq } from "drizzle-orm";
import { db } from "../../../shared/api/drizzle.api";
import { workspaceSettings } from "../../../shared/api/schema.types";
import type { WorkspaceSettings } from "../model/workspace.types";

function normalizePort(value: number | null | undefined): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (!Number.isInteger(value)) {
    return null;
  }
  if (value < 1 || value > 65535) {
    return null;
  }
  return value;
}

export async function loadWorkspaceSettings(workspaceId: number): Promise<WorkspaceSettings> {
  const rows = await db
    .select()
    .from(workspaceSettings)
    .where(eq(workspaceSettings.workspaceId, workspaceId))
    .limit(1);

  const row = rows[0];
  if (!row) {
    return {
      workspaceId,
      defaultPort: null,
      framework: null,
    };
  }

  return {
    workspaceId,
    defaultPort: normalizePort(row.defaultPort),
    framework: row.framework ?? null,
  };
}

export async function saveWorkspaceSettings(
  workspaceId: number,
  defaultPort: number | null = null,
  framework: string | null = null,
): Promise<WorkspaceSettings> {
  const normalizedPort = normalizePort(defaultPort);
  const normalizedFramework = framework?.trim() ? framework.trim() : null;

  await db
    .insert(workspaceSettings)
    .values({
      workspaceId,
      defaultPort: normalizedPort,
      framework: normalizedFramework,
    })
    .onConflictDoUpdate({
      target: workspaceSettings.workspaceId,
      set: {
        defaultPort: normalizedPort,
        framework: normalizedFramework,
      },
    });

  return {
    workspaceId,
    defaultPort: normalizedPort,
    framework: normalizedFramework,
  };
}
