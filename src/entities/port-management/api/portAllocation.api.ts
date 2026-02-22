import { eq, and } from "drizzle-orm";
import { db } from "../../../shared/api/drizzle.api";
import { portAllocations } from "../../../shared/api/schema.types";
import type { PortAllocation, PortEntityType, AllocatePortInput } from "../model/portAllocation.types";
import { findNextFreePort } from "../lib/portScanner.pure";
import { checkPortAvailable } from "./portAvailability.api";

function isValidPort(port: number | undefined): port is number {
  return typeof port === "number" && Number.isInteger(port) && port >= 1 && port <= 65535;
}

function rowToAllocation(row: typeof portAllocations.$inferSelect): PortAllocation {
  return {
    id: row.id,
    entityType: row.entityType as PortEntityType,
    entityId: row.entityId,
    projectId: row.projectId,
    port: row.port,
    framework: row.framework,
    proxyHostname: row.proxyHostname,
    createdAtMs: row.createdAtMs,
  };
}

export async function listAllPortAllocations(): Promise<PortAllocation[]> {
  const rows = await db.select().from(portAllocations);
  return rows.map(rowToAllocation);
}

export async function listPortAllocationsForProject(projectId: number): Promise<PortAllocation[]> {
  const rows = await db
    .select()
    .from(portAllocations)
    .where(eq(portAllocations.projectId, projectId));
  return rows.map(rowToAllocation);
}

export async function getPortAllocation(
  entityType: PortEntityType,
  entityId: number,
): Promise<PortAllocation | null> {
  const rows = await db
    .select()
    .from(portAllocations)
    .where(
      and(
        eq(portAllocations.entityType, entityType),
        eq(portAllocations.entityId, entityId),
      ),
    );
  return rows[0] ? rowToAllocation(rows[0]) : null;
}

export async function allocatePort(input: AllocatePortInput): Promise<PortAllocation> {
  const existing = await getPortAllocation(input.entityType, input.entityId);
  if (existing) {
    return existing;
  }

  const allRows = await db.select({ port: portAllocations.port }).from(portAllocations);
  const allocatedPorts = new Set(allRows.map((r) => r.port));
  let selectedPort: number | null = null;
  const preferredPort = input.preferredPort;

  if (isValidPort(preferredPort) && !allocatedPorts.has(preferredPort)) {
    const available = await checkPortAvailable(preferredPort);
    if (available) {
      selectedPort = preferredPort;
    }
  }

  if (selectedPort === null) {
    let candidate = findNextFreePort(allocatedPorts);
    while (candidate !== null) {
      const available = await checkPortAvailable(candidate);
      if (available) {
        selectedPort = candidate;
        break;
      }
      allocatedPorts.add(candidate);
      candidate = findNextFreePort(allocatedPorts);
    }
  }

  if (selectedPort === null) {
    throw new Error(
      "No free and available ports were found in range 3100-3999 (and preferred port was unavailable).",
    );
  }

  const nowMs = Date.now();
  await db.insert(portAllocations).values({
    entityType: input.entityType,
    entityId: input.entityId,
    projectId: input.projectId,
    port: selectedPort,
    framework: input.framework,
    createdAtMs: nowMs,
  });

  // Re-read with a stable query to get the actual inserted row
  const inserted = await getPortAllocation(input.entityType, input.entityId);
  if (!inserted) {
    throw new Error("Failed to read back allocated port.");
  }
  return inserted;
}

export async function deletePortAllocation(
  entityType: PortEntityType,
  entityId: number,
): Promise<void> {
  await db
    .delete(portAllocations)
    .where(
      and(
        eq(portAllocations.entityType, entityType),
        eq(portAllocations.entityId, entityId),
      ),
    );
}

export async function updateProxyHostname(
  entityType: PortEntityType,
  entityId: number,
  hostname: string,
): Promise<void> {
  await db
    .update(portAllocations)
    .set({ proxyHostname: hostname })
    .where(
      and(
        eq(portAllocations.entityType, entityType),
        eq(portAllocations.entityId, entityId),
      ),
    );
}
