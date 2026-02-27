import { and, asc, eq } from "drizzle-orm";
import { db } from "../../../shared/api/drizzle.api";
import { promptQueueItems } from "../../../shared/api/schema.types";
import type {
  CreatePromptQueueItemInput,
  PromptQueueItemRow,
  PromptQueueScopeType,
} from "../model/promptQueue.types";

export async function listPromptQueueItems(
  scopeType: PromptQueueScopeType,
  scopeId: number,
): Promise<PromptQueueItemRow[]> {
  return db
    .select()
    .from(promptQueueItems)
    .where(and(
      eq(promptQueueItems.scopeType, scopeType),
      eq(promptQueueItems.scopeId, scopeId),
    ))
    .orderBy(asc(promptQueueItems.createdAtMs), asc(promptQueueItems.id));
}

export async function enqueuePromptQueueItem(input: CreatePromptQueueItemInput): Promise<number> {
  const prompt = input.prompt.trim();
  if (!prompt) {
    throw new Error("Prompt cannot be empty.");
  }

  const rows = await db
    .insert(promptQueueItems)
    .values({
      scopeType: input.scopeType,
      scopeId: input.scopeId,
      prompt,
      createdAtMs: Date.now(),
    })
    .returning({ id: promptQueueItems.id });

  return rows[0]?.id ?? 0;
}

export async function deletePromptQueueItem(itemId: number): Promise<void> {
  await db
    .delete(promptQueueItems)
    .where(eq(promptQueueItems.id, itemId));
}

export async function clearPromptQueueItems(
  scopeType: PromptQueueScopeType,
  scopeId: number,
): Promise<void> {
  await db
    .delete(promptQueueItems)
    .where(and(
      eq(promptQueueItems.scopeType, scopeType),
      eq(promptQueueItems.scopeId, scopeId),
    ));
}
