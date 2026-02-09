import { getDb } from "../../../shared/api/database.api";
import type {
  Automation,
  AutomationRun,
  CreateAutomationInput,
  CreateAutomationRunInput,
  UpdateAutomationInput,
} from "../model/automation.types";

interface AutomationRow {
  id: number;
  name: string;
  project_id: number;
  agent: "claude" | "codex";
  prompt: string;
  interval_hours: number;
  enabled: number;
  last_run_at_ms: number | null;
  next_run_at_ms: number | null;
  created_at_ms: number;
  updated_at_ms: number;
}

interface AutomationRunRow {
  id: number;
  automation_id: number;
  trigger_source: "schedule" | "manual" | "startup_catchup";
  status: "queued" | "running" | "success" | "error" | "skipped";
  started_at_ms: number | null;
  ended_at_ms: number | null;
  error: string | null;
  details_json: string | null;
}

function mapAutomationRow(row: AutomationRow): Automation {
  return {
    id: row.id,
    name: row.name,
    projectId: row.project_id,
    agent: row.agent,
    prompt: row.prompt,
    intervalHours: row.interval_hours,
    enabled: Boolean(row.enabled),
    lastRunAtMs: row.last_run_at_ms,
    nextRunAtMs: row.next_run_at_ms,
    createdAtMs: row.created_at_ms,
    updatedAtMs: row.updated_at_ms,
  };
}

function mapAutomationRunRow(row: AutomationRunRow): AutomationRun {
  return {
    id: row.id,
    automationId: row.automation_id,
    triggerSource: row.trigger_source,
    status: row.status,
    startedAtMs: row.started_at_ms,
    endedAtMs: row.ended_at_ms,
    error: row.error,
    detailsJson: row.details_json,
  };
}

export async function listAutomations(): Promise<Automation[]> {
  const database = await getDb();
  const rows = await database.select<AutomationRow[]>(
    "SELECT * FROM automations ORDER BY updated_at_ms DESC"
  );
  return rows.map(mapAutomationRow);
}

export async function insertAutomation(input: CreateAutomationInput): Promise<number> {
  const nowMs = Date.now();
  const nextRunAtMs = input.enabled ? nowMs + input.intervalHours * 60 * 60 * 1000 : null;
  const database = await getDb();
  await database.execute(
    `INSERT INTO automations (
      name,
      project_id,
      agent,
      prompt,
      interval_hours,
      enabled,
      last_run_at_ms,
      next_run_at_ms,
      created_at_ms,
      updated_at_ms
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.name,
      input.projectId,
      input.agent,
      input.prompt,
      input.intervalHours,
      input.enabled ? 1 : 0,
      null,
      nextRunAtMs,
      nowMs,
      nowMs,
    ]
  );
  const rows = await database.select<{ id: number }[]>("SELECT last_insert_rowid() AS id");
  return rows[0]?.id ?? 0;
}

export async function updateAutomation(input: UpdateAutomationInput): Promise<void> {
  const nowMs = Date.now();
  const database = await getDb();
  const existingRows = await database.select<Pick<AutomationRow, "last_run_at_ms">[]>(
    "SELECT last_run_at_ms FROM automations WHERE id = ?",
    [input.id]
  );
  const lastRunAtMs = existingRows[0]?.last_run_at_ms ?? null;
  const nextRunAtMs = input.enabled
    ? (lastRunAtMs ?? nowMs) + input.intervalHours * 60 * 60 * 1000
    : null;

  await database.execute(
    `UPDATE automations
       SET name = ?,
           project_id = ?,
           agent = ?,
           prompt = ?,
           interval_hours = ?,
           enabled = ?,
           next_run_at_ms = ?,
           updated_at_ms = ?
     WHERE id = ?`,
    [
      input.name,
      input.projectId,
      input.agent,
      input.prompt,
      input.intervalHours,
      input.enabled ? 1 : 0,
      nextRunAtMs,
      nowMs,
      input.id,
    ]
  );
}

export async function deleteAutomation(automationId: number): Promise<void> {
  const database = await getDb();
  await database.execute("DELETE FROM automations WHERE id = ?", [automationId]);
}

export async function listAutomationRuns(limit: number = 200): Promise<AutomationRun[]> {
  const database = await getDb();
  const rows = await database.select<AutomationRunRow[]>(
    "SELECT * FROM automation_runs ORDER BY id DESC LIMIT ?",
    [limit]
  );
  return rows.map(mapAutomationRunRow);
}

export async function insertAutomationRun(input: CreateAutomationRunInput): Promise<number> {
  const database = await getDb();
  const startedAtMs = input.startedAtMs ?? null;
  await database.execute(
    `INSERT INTO automation_runs (
      automation_id,
      trigger_source,
      status,
      started_at_ms,
      ended_at_ms,
      error,
      details_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      input.automationId,
      input.triggerSource,
      input.status,
      startedAtMs,
      input.endedAtMs ?? null,
      input.error ?? null,
      input.detailsJson ?? null,
    ]
  );

  // tauri-plugin-sql may not preserve last_insert_rowid() across pooled statements.
  // Resolve by querying the just-inserted row with stable attributes.
  if (startedAtMs !== null) {
    const rows = await database.select<{ id: number }[]>(
      `SELECT id
         FROM automation_runs
        WHERE automation_id = ?
          AND trigger_source = ?
          AND started_at_ms = ?
        ORDER BY id DESC
        LIMIT 1`,
      [input.automationId, input.triggerSource, startedAtMs]
    );
    if (rows[0]?.id) {
      return rows[0].id;
    }
  }

  const fallbackRows = await database.select<{ id: number }[]>(
    "SELECT id FROM automation_runs WHERE automation_id = ? ORDER BY id DESC LIMIT 1",
    [input.automationId]
  );
  return fallbackRows[0]?.id ?? 0;
}

export async function updateAutomationRun(
  runId: number,
  input: {
    status: AutomationRun["status"];
    startedAtMs?: number | null;
    endedAtMs?: number | null;
    error?: string | null;
    detailsJson?: string | null;
  }
): Promise<void> {
  const database = await getDb();
  await database.execute(
    `UPDATE automation_runs
       SET status = ?,
           started_at_ms = ?,
           ended_at_ms = ?,
           error = ?,
           details_json = ?
     WHERE id = ?`,
    [
      input.status,
      input.startedAtMs ?? null,
      input.endedAtMs ?? null,
      input.error ?? null,
      input.detailsJson ?? null,
      runId,
    ]
  );
}

export async function markAutomationRunSchedule(
  automationId: number,
  input: {
    lastRunAtMs: number;
    nextRunAtMs: number | null;
  }
): Promise<void> {
  const database = await getDb();
  await database.execute(
    `UPDATE automations
       SET last_run_at_ms = ?,
           next_run_at_ms = ?,
           updated_at_ms = ?
     WHERE id = ?`,
    [
      input.lastRunAtMs,
      input.nextRunAtMs,
      Date.now(),
      automationId,
    ]
  );
}
