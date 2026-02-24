import type { Automation } from "../../../entities/automation";

interface TriggerConfigInput {
  baseBranches?: unknown;
}

export function parseGithubTriggerBaseBranches(configJson: string | null): string[] {
  if (!configJson) {
    return [];
  }

  try {
    const parsed = JSON.parse(configJson) as TriggerConfigInput;
    if (!Array.isArray(parsed.baseBranches)) {
      return [];
    }
    return parsed.baseBranches
      .map((branch) => (typeof branch === "string" ? branch.trim() : ""))
      .filter((branch) => branch.length > 0);
  } catch {
    return [];
  }
}

export function doesAutomationMatchGithubMergedEvent(input: {
  automation: Automation;
  sourceRepoKey: string | null;
  eventRepoKey: string;
  eventBaseRef: string;
}): boolean {
  const { automation, sourceRepoKey, eventRepoKey, eventBaseRef } = input;
  if (!automation.enabled) {
    return false;
  }
  if (automation.runMode !== "event") {
    return false;
  }
  if (automation.triggerType !== "github_pr_merged") {
    return false;
  }
  if (!automation.sourceProjectId || !automation.targetProjectId) {
    return false;
  }
  if (!sourceRepoKey || sourceRepoKey !== eventRepoKey) {
    return false;
  }

  const baseBranches = parseGithubTriggerBaseBranches(automation.triggerConfigJson);
  if (baseBranches.length === 0) {
    return false;
  }

  return baseBranches.includes(eventBaseRef);
}
