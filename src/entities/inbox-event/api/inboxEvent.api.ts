import { desc, eq, sql } from "drizzle-orm";
import { db } from "../../../shared/api/drizzle.api";
import { githubPollState, inboxEvents } from "../../../shared/api/schema";
import type {
  CreateInboxEventInput,
  InboxEvent,
  InboxFilter,
} from "../model/inboxEvent.types";

export async function listInboxEvents(filter: InboxFilter = "all", limit: number = 300): Promise<InboxEvent[]> {
  const query = db.select().from(inboxEvents).orderBy(desc(inboxEvents.createdAtMs)).limit(limit);

  if (filter === "unread") {
    return query.where(eq(inboxEvents.read, false));
  }
  if (filter === "automation") {
    return query.where(eq(inboxEvents.source, "automation"));
  }
  if (filter === "github") {
    return query.where(eq(inboxEvents.source, "github"));
  }
  return query;
}

export async function insertInboxEvent(input: CreateInboxEventInput): Promise<number | null> {
  try {
    const rows = await db
      .insert(inboxEvents)
      .values({
        kind: input.kind,
        source: input.source,
        projectId: input.projectId ?? null,
        automationId: input.automationId ?? null,
        automationRunId: input.automationRunId ?? null,
        externalId: input.externalId ?? null,
        title: input.title,
        body: input.body ?? null,
        payloadJson: input.payloadJson ?? null,
        read: false,
        createdAtMs: input.createdAtMs ?? Date.now(),
      })
      .onConflictDoNothing()
      .returning({ id: inboxEvents.id });

    return rows[0]?.id ?? null;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.toLowerCase().includes("unique")) {
      return null;
    }
    throw error;
  }
}

export async function markInboxEventRead(eventId: number): Promise<void> {
  await db
    .update(inboxEvents)
    .set({ read: true })
    .where(eq(inboxEvents.id, eventId));
}

export async function markAllInboxEventsRead(): Promise<void> {
  await db
    .update(inboxEvents)
    .set({ read: true })
    .where(eq(inboxEvents.read, false));
}

export async function countUnreadInboxEvents(): Promise<number> {
  const rows = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(inboxEvents)
    .where(eq(inboxEvents.read, false));
  return rows[0]?.count ?? 0;
}

export async function getGithubPollState(repoKey: string): Promise<number | null> {
  const rows = await db
    .select({ lastPolledAtMs: githubPollState.lastPolledAtMs })
    .from(githubPollState)
    .where(eq(githubPollState.repoKey, repoKey));

  return rows[0]?.lastPolledAtMs ?? null;
}

export async function upsertGithubPollState(repoKey: string, lastPolledAtMs: number): Promise<void> {
  await db
    .insert(githubPollState)
    .values({ repoKey, lastPolledAtMs })
    .onConflictDoUpdate({
      target: githubPollState.repoKey,
      set: { lastPolledAtMs },
    });
}
