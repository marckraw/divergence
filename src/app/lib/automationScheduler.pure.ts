import type { Automation } from "../../entities/automation";

const HOUR_MS = 60 * 60 * 1000;

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

export function buildAutomationBranchName(automationId: number, nowMs: number = Date.now()): string {
  const stamp = new Date(nowMs).toISOString()
    .replace(/-/g, "")
    .replace(/:/g, "")
    .replace(/\./g, "")
    .replace("T", "-")
    .replace("Z", "");
  return `automation/${automationId}-${stamp}`;
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
