import { and, desc, eq } from "drizzle-orm";
import { db } from "../../../shared/api/drizzle.api";
import { automationTriggerDispatches } from "../../../shared/api/schema.types";
import type {
  AutomationTriggerDispatchRow,
  CreateAutomationTriggerDispatchInput,
} from "../model/automationTrigger.types";

export async function listAutomationTriggerDispatches(limit: number = 200): Promise<AutomationTriggerDispatchRow[]> {
  return db
    .select()
    .from(automationTriggerDispatches)
    .orderBy(desc(automationTriggerDispatches.id))
    .limit(limit);
}

export async function getAutomationTriggerDispatchByEvent(
  automationId: number,
  externalEventId: string,
): Promise<AutomationTriggerDispatchRow | null> {
  const rows = await db
    .select()
    .from(automationTriggerDispatches)
    .where(
      and(
        eq(automationTriggerDispatches.automationId, automationId),
        eq(automationTriggerDispatches.externalEventId, externalEventId),
      ),
    )
    .limit(1);

  return rows[0] ?? null;
}

export async function insertAutomationTriggerDispatch(
  input: CreateAutomationTriggerDispatchInput,
): Promise<number | null> {
  const nowMs = Date.now();
  const rows = await db
    .insert(automationTriggerDispatches)
    .values({
      automationId: input.automationId,
      externalEventId: input.externalEventId,
      status: input.status,
      automationRunId: input.automationRunId ?? null,
      error: input.error ?? null,
      createdAtMs: nowMs,
      updatedAtMs: nowMs,
    })
    .onConflictDoNothing()
    .returning({ id: automationTriggerDispatches.id });

  return rows[0]?.id ?? null;
}

export async function updateAutomationTriggerDispatch(input: {
  id: number;
  status: "pending" | "launched" | "skipped" | "error";
  automationRunId?: number | null;
  error?: string | null;
}): Promise<void> {
  await db
    .update(automationTriggerDispatches)
    .set({
      status: input.status,
      automationRunId: input.automationRunId ?? null,
      error: input.error ?? null,
      updatedAtMs: Date.now(),
    })
    .where(eq(automationTriggerDispatches.id, input.id));
}
