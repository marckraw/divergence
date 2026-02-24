export { useCloudAutomationEventPoller } from "./model/useCloudAutomationEventPoller";
export type {
  DispatchTriggeredAutomationRunResult,
  MatchedGithubAutomation,
  TriggeredAutomationContext,
} from "./model/automationTriggers.types";
export { matchGithubMergedTriggers } from "./service/matchGithubMergedTriggers.service";
export { dispatchTriggeredAutomations } from "./service/dispatchTriggeredAutomation.service";
export { ensureAutomationWorkspace } from "./service/ensureAutomationWorkspace.service";
export {
  doesAutomationMatchGithubMergedEvent,
  parseGithubTriggerBaseBranches,
} from "./lib/triggerMatching.pure";
