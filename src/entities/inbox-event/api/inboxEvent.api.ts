import { getDb } from "../../../shared/api/database.api";
import type {
  CreateInboxEventInput,
  InboxEvent,
  InboxFilter,
} from "../model/inboxEvent.types";

interface InboxEventRow {
  id: number;
  kind: InboxEvent["kind"];
  source: InboxEvent["source"];
  project_id: number | null;
  automation_id: number | null;
  automation_run_id: number | null;
  external_id: string | null;
  title: string;
  body: string | null;
  payload_json: string | null;
  read: number;
  created_at_ms: number;
}

function mapInboxEventRow(row: InboxEventRow): InboxEvent {
  return {
    id: row.id,
    kind: row.kind,
    source: row.source,
    projectId: row.project_id,
    automationId: row.automation_id,
    automationRunId: row.automation_run_id,
    externalId: row.external_id,
    title: row.title,
    body: row.body,
    payloadJson: row.payload_json,
    read: Boolean(row.read),
    createdAtMs: row.created_at_ms,
  };
}

export async function listInboxEvents(filter: InboxFilter = "all", limit: number = 300): Promise<InboxEvent[]> {
  const database = await getDb();

  if (filter === "unread") {
    const rows = await database.select<InboxEventRow[]>(
      "SELECT * FROM inbox_events WHERE read = 0 ORDER BY created_at_ms DESC LIMIT ?",
      [limit]
    );
    return rows.map(mapInboxEventRow);
  }

  if (filter === "automation") {
    const rows = await database.select<InboxEventRow[]>(
      "SELECT * FROM inbox_events WHERE source = 'automation' ORDER BY created_at_ms DESC LIMIT ?",
      [limit]
    );
    return rows.map(mapInboxEventRow);
  }

  if (filter === "github") {
    const rows = await database.select<InboxEventRow[]>(
      "SELECT * FROM inbox_events WHERE source = 'github' ORDER BY created_at_ms DESC LIMIT ?",
      [limit]
    );
    return rows.map(mapInboxEventRow);
  }

  const rows = await database.select<InboxEventRow[]>(
    "SELECT * FROM inbox_events ORDER BY created_at_ms DESC LIMIT ?",
    [limit]
  );
  return rows.map(mapInboxEventRow);
}

export async function insertInboxEvent(input: CreateInboxEventInput): Promise<number | null> {
  const database = await getDb();
  try {
    await database.execute(
      `INSERT INTO inbox_events (
        kind,
        source,
        project_id,
        automation_id,
        automation_run_id,
        external_id,
        title,
        body,
        payload_json,
        read,
        created_at_ms
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.kind,
        input.source,
        input.projectId ?? null,
        input.automationId ?? null,
        input.automationRunId ?? null,
        input.externalId ?? null,
        input.title,
        input.body ?? null,
        input.payloadJson ?? null,
        0,
        input.createdAtMs ?? Date.now(),
      ]
    );
    const rows = await database.select<{ id: number }[]>("SELECT last_insert_rowid() AS id");
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
  const database = await getDb();
  await database.execute("UPDATE inbox_events SET read = 1 WHERE id = ?", [eventId]);
}

export async function markAllInboxEventsRead(): Promise<void> {
  const database = await getDb();
  await database.execute("UPDATE inbox_events SET read = 1 WHERE read = 0");
}

export async function countUnreadInboxEvents(): Promise<number> {
  const database = await getDb();
  const rows = await database.select<{ count: number }[]>(
    "SELECT COUNT(*) AS count FROM inbox_events WHERE read = 0"
  );
  return rows[0]?.count ?? 0;
}

export async function getGithubPollState(repoKey: string): Promise<number | null> {
  const database = await getDb();
  const rows = await database.select<{ last_polled_at_ms: number }[]>(
    "SELECT last_polled_at_ms FROM github_poll_state WHERE repo_key = ?",
    [repoKey]
  );
  if (!rows.length) {
    return null;
  }
  return rows[0]?.last_polled_at_ms ?? null;
}

export async function upsertGithubPollState(repoKey: string, lastPolledAtMs: number): Promise<void> {
  const database = await getDb();
  await database.execute(
    `INSERT INTO github_poll_state (repo_key, last_polled_at_ms)
     VALUES (?, ?)
     ON CONFLICT(repo_key) DO UPDATE SET
       last_polled_at_ms = excluded.last_polled_at_ms`,
    [repoKey, lastPolledAtMs]
  );
}
