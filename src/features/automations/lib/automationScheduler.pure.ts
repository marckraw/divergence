import type { Automation } from "../../../entities/automation";

const HOUR_MS = 60 * 60 * 1000;
const AUTOMATION_NAME_MAX_SLUG_LENGTH = 32;

export function normalizeAutomationIntervalHours(intervalHours: number): number {
  if (!Number.isFinite(intervalHours)) {
    return 1;
  }
  return Math.max(1, Math.floor(intervalHours));
}

export function computeAutomationNextRunAtMs(lastRunAtMs: number, intervalHours: number): number {
  return lastRunAtMs + normalizeAutomationIntervalHours(intervalHours) * HOUR_MS;
}

export function isAutomationDue(
  automation: Pick<Automation, "enabled" | "nextRunAtMs">,
  nowMs: number
): boolean {
  if (!automation.enabled) {
    return false;
  }
  if (automation.nextRunAtMs === null) {
    return false;
  }
  return automation.nextRunAtMs <= nowMs;
}

/**
 * Fixed-clock scheduling: anchors to the previous scheduled time, not completion time.
 * If multiple intervals have been missed, advances to the next future slot.
 *
 * For manual runs or first runs (nextRunAtMs is null), falls back to nowMs as anchor.
 */
export function computeNextScheduledRunAtMs(
  automation: Pick<Automation, "enabled" | "intervalHours" | "nextRunAtMs">,
  nowMs: number,
): number | null {
  if (!automation.enabled) return null;
  const intervalMs = normalizeAutomationIntervalHours(automation.intervalHours) * HOUR_MS;
  const anchor = automation.nextRunAtMs ?? nowMs;
  let next = anchor + intervalMs;
  // If we've fallen behind (app closed, long run), advance to next future slot.
  // Use `< nowMs` first for bulk skip, then `<= nowMs` to guarantee next > nowMs
  // (avoids Math.ceil(0) == 0 when next lands exactly on nowMs).
  if (next <= nowMs) {
    const missedIntervals = Math.ceil((nowMs - next) / intervalMs);
    next += missedIntervals * intervalMs;
    // If next still equals nowMs (boundary case), push one more interval ahead
    if (next <= nowMs) {
      next += intervalMs;
    }
  }
  return next;
}

/**
 * Filters automations to those that are due and not already running.
 */
export function findDueAutomations(
  automations: Automation[],
  runningAutomationIds: ReadonlySet<number>,
  nowMs: number,
): Automation[] {
  return automations.filter(
    (a) => isAutomationDue(a, nowMs) && !runningAutomationIds.has(a.id),
  );
}

export function sanitizeAutomationNameForBranch(automationName: string): string {
  const normalized = automationName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "");
  if (!normalized) {
    return "run";
  }
  return normalized.slice(0, AUTOMATION_NAME_MAX_SLUG_LENGTH).replace(/-+$/, "") || "run";
}

export function buildAutomationBranchName(
  automationId: number,
  automationName: string,
  nowMs: number = Date.now()
): string {
  const stamp = new Date(nowMs).toISOString()
    .replace(/-/g, "")
    .replace(/:/g, "")
    .replace(/\./g, "")
    .replace("T", "-")
    .replace("Z", "");
  const nameSlug = sanitizeAutomationNameForBranch(automationName);
  return `automation/${automationId}-${nameSlug}-${stamp}`;
}

export function buildAutomationPromptMarkdown(input: {
  automationName: string;
  projectName: string;
  triggerSource: string;
  prompt: string;
  generatedAtMs: number;
}): string {
  return [
    `# Automation Run: ${input.automationName}`,
    "",
    `Project: ${input.projectName}`,
    `Trigger: ${input.triggerSource}`,
    `Generated at: ${new Date(input.generatedAtMs).toISOString()}`,
    "",
    "## Prompt",
    input.prompt.trim(),
    "",
  ].join("\n");
}
