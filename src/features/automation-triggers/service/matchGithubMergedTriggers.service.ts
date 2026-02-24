import type { Project } from "../../../entities";
import type { Automation } from "../../../entities/automation";
import type { GithubPrMergedAutomationEvent } from "../../../shared";
import {
  getProjectGithubRepository,
} from "../../../shared";
import {
  doesAutomationMatchGithubMergedEvent,
  parseGithubTriggerBaseBranches,
} from "../lib/triggerMatching.pure";
import type { MatchedGithubAutomation } from "../model/automationTriggers.types";

interface MatchGithubMergedTriggersInput {
  automations: Automation[];
  projectsById: Map<number, Project>;
  event: GithubPrMergedAutomationEvent;
}

export async function matchGithubMergedTriggers({
  automations,
  projectsById,
  event,
}: MatchGithubMergedTriggersInput): Promise<MatchedGithubAutomation[]> {
  const sourceRepoKeyByProjectId = new Map<number, string | null>();
  const matches: MatchedGithubAutomation[] = [];

  for (const automation of automations) {
    if (!automation.sourceProjectId) {
      continue;
    }

    let sourceRepoKey = sourceRepoKeyByProjectId.get(automation.sourceProjectId);
    if (sourceRepoKey === undefined) {
      const sourceProject = projectsById.get(automation.sourceProjectId);
      if (!sourceProject) {
        sourceRepoKeyByProjectId.set(automation.sourceProjectId, null);
        continue;
      }
      const sourceRepo = await getProjectGithubRepository(sourceProject.path);
      sourceRepoKey = sourceRepo?.repoKey ?? null;
      sourceRepoKeyByProjectId.set(automation.sourceProjectId, sourceRepoKey);
    }

    if (!doesAutomationMatchGithubMergedEvent({
      automation,
      sourceRepoKey: sourceRepoKey ?? null,
      eventRepoKey: event.repoKey,
      eventBaseRef: event.baseRef,
    })) {
      continue;
    }

    matches.push({
      automation,
      baseBranches: parseGithubTriggerBaseBranches(automation.triggerConfigJson),
    });
  }

  return matches;
}
