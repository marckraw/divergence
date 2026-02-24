import type { Automation } from "../../../entities/automation";
import type { GithubPrMergedAutomationEvent } from "../../../shared";

export interface MatchedGithubAutomation {
  automation: Automation;
  baseBranches: string[];
}

export interface DispatchTriggeredAutomationRunResult {
  status: "launched" | "skipped";
  runId?: number;
}

export interface TriggeredAutomationContext {
  event: GithubPrMergedAutomationEvent;
  sourceRepoKey: string;
}
