import { asc, desc, eq } from "drizzle-orm";
import { db } from "../../../shared/api/drizzle.api";
import { automationRuns, automations } from "../../../shared/api/schema";
import type {
  Automation,
  AutomationRun,
  CreateAutomationInput,
  CreateAutomationRunInput,
  UpdateAutomationInput,
} from "../model/automation.types";

export async function listAutomations(): Promise<Automation[]> {
  return db.select().from(automations).orderBy(desc(automations.updatedAtMs));
}

export async function insertAutomation(input: CreateAutomationInput): Promise<number> {
  const nowMs = Date.now();
  const nextRunAtMs = input.enabled ? nowMs + input.intervalHours * 60 * 60 * 1000 : null;

  const rows = await db
    .insert(automations)
    .values({
      name: input.name,
      projectId: input.projectId,
      agent: input.agent,
      prompt: input.prompt,
      intervalHours: input.intervalHours,
      enabled: input.enabled,
      keepSessionAlive: input.keepSessionAlive,
      lastRunAtMs: null,
      nextRunAtMs,
      createdAtMs: nowMs,
      updatedAtMs: nowMs,
    })
    .returning({ id: automations.id });

  return rows[0]?.id ?? 0;
}

export async function updateAutomation(input: UpdateAutomationInput): Promise<void> {
  const nowMs = Date.now();

  const existingRows = await db
    .select({ lastRunAtMs: automations.lastRunAtMs })
    .from(automations)
    .where(eq(automations.id, input.id));

  const lastRunAtMs = existingRows[0]?.lastRunAtMs ?? null;
  const nextRunAtMs = input.enabled
    ? (lastRunAtMs ?? nowMs) + input.intervalHours * 60 * 60 * 1000
    : null;

  await db
    .update(automations)
    .set({
      name: input.name,
      projectId: input.projectId,
      agent: input.agent,
      prompt: input.prompt,
      intervalHours: input.intervalHours,
      enabled: input.enabled,
      keepSessionAlive: input.keepSessionAlive,
      nextRunAtMs,
      updatedAtMs: nowMs,
    })
    .where(eq(automations.id, input.id));
}

export async function deleteAutomation(automationId: number): Promise<void> {
  await db.delete(automations).where(eq(automations.id, automationId));
}

export async function listAutomationRuns(limit: number = 200): Promise<AutomationRun[]> {
  return db
    .select()
    .from(automationRuns)
    .orderBy(desc(automationRuns.id))
    .limit(limit);
}

export async function insertAutomationRun(input: CreateAutomationRunInput): Promise<number> {
  const rows = await db
    .insert(automationRuns)
    .values({
      automationId: input.automationId,
      triggerSource: input.triggerSource,
      status: input.status,
      startedAtMs: input.startedAtMs ?? null,
      endedAtMs: input.endedAtMs ?? null,
      error: input.error ?? null,
      detailsJson: input.detailsJson ?? null,
      keepSessionAlive: input.keepSessionAlive ?? false,
      tmuxSessionName: input.tmuxSessionName ?? null,
      logFilePath: input.logFilePath ?? null,
      resultFilePath: input.resultFilePath ?? null,
    })
    .returning({ id: automationRuns.id });

  return rows[0]?.id ?? 0;
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
  const fields: Record<string, unknown> = { status: input.status };
  if ("startedAtMs" in input) fields.startedAtMs = input.startedAtMs ?? null;
  if ("endedAtMs" in input) fields.endedAtMs = input.endedAtMs ?? null;
  if ("error" in input) fields.error = input.error ?? null;
  if ("detailsJson" in input) fields.detailsJson = input.detailsJson ?? null;

  await db
    .update(automationRuns)
    .set(fields)
    .where(eq(automationRuns.id, runId));
}

export async function listRunningAutomationRuns(): Promise<AutomationRun[]> {
  return db
    .select()
    .from(automationRuns)
    .where(eq(automationRuns.status, "running"))
    .orderBy(asc(automationRuns.id));
}

export async function updateAutomationRunTmuxSession(
  runId: number,
  input: {
    tmuxSessionName: string;
    logFilePath: string;
    resultFilePath: string;
  }
): Promise<void> {
  await db
    .update(automationRuns)
    .set({
      tmuxSessionName: input.tmuxSessionName,
      logFilePath: input.logFilePath,
      resultFilePath: input.resultFilePath,
    })
    .where(eq(automationRuns.id, runId));
}

export async function markAutomationRunSchedule(
  automationId: number,
  input: {
    lastRunAtMs: number;
    nextRunAtMs: number | null;
  }
): Promise<void> {
  await db
    .update(automations)
    .set({
      lastRunAtMs: input.lastRunAtMs,
      nextRunAtMs: input.nextRunAtMs,
      updatedAtMs: Date.now(),
    })
    .where(eq(automations.id, automationId));
}
