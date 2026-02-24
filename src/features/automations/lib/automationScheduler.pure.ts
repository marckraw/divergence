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
  automation: Pick<Automation, "enabled" | "intervalHours" | "nextRunAtMs" | "runMode">,
  nowMs: number,
): number | null {
  if (!automation.enabled) return null;
  if (automation.runMode === "event") return null;
  const intervalMs = normalizeAutomationIntervalHours(automation.intervalHours) * HOUR_MS;
  const anchor = automation.nextRunAtMs ?? nowMs;
  let next = anchor + intervalMs;
  // If we've fallen behind (app closed, long run), advance to next future slot
  if (next <= nowMs) {
    const missedIntervals = Math.floor((nowMs - next) / intervalMs) + 1;
    next += missedIntervals * intervalMs;
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
    (a) => a.runMode === "schedule" && isAutomationDue(a, nowMs) && !runningAutomationIds.has(a.id),
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
  triggerContext?: {
    sourceRepoKey: string;
    targetProjectName: string;
    targetProjectPath: string;
    pullRequestNumber: number;
    pullRequestUrl: string;
    baseRef: string;
    headRef: string;
    mergeCommitSha: string;
    mergedAtMs: number;
  };
}): string {
  const lines = [
    `# Automation Run: ${input.automationName}`,
    "",
    `Project: ${input.projectName}`,
    `Trigger: ${input.triggerSource}`,
    `Generated at: ${new Date(input.generatedAtMs).toISOString()}`,
  ];

  if (input.triggerContext) {
    lines.push(
      "",
      "## Trigger Context",
      `Source repo: ${input.triggerContext.sourceRepoKey}`,
      `Target project: ${input.triggerContext.targetProjectName}`,
      `Target path: ${input.triggerContext.targetProjectPath}`,
      `PR: #${input.triggerContext.pullRequestNumber} (${input.triggerContext.pullRequestUrl})`,
      `Base branch: ${input.triggerContext.baseRef}`,
      `Head branch: ${input.triggerContext.headRef}`,
      `Merge commit: ${input.triggerContext.mergeCommitSha}`,
      `Merged at: ${new Date(input.triggerContext.mergedAtMs).toISOString()}`,
      "",
      "## Required Outcome",
      "- Inspect source merge impact.",
      "- Update the target project to match the released capabilities.",
      "- Create a branch, commit, push, and open a PR in the target repository.",
      "- Return the resulting PR URL in the output.",
    );
  }

  lines.push(
    "",
    "## Prompt",
    input.prompt.trim(),
    "",
  );

  return lines.join("\n");
}
