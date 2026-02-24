import {
  insertAutomationTriggerDispatch,
  updateAutomationTriggerDispatch,
} from "../../../entities/automation-trigger";
import type { MatchedGithubAutomation } from "../model/automationTriggers.types";

export async function dispatchTriggeredAutomations(input: {
  matches: MatchedGithubAutomation[];
  externalEventId: string;
  launchAutomation: (automationId: number) => Promise<number | null>;
}): Promise<void> {
  for (const match of input.matches) {
    const dispatchId = await insertAutomationTriggerDispatch({
      automationId: match.automation.id,
      externalEventId: input.externalEventId,
      status: "pending",
    });

    // Duplicate event for this automation: already handled or in-flight.
    if (dispatchId === null) {
      continue;
    }

    try {
      const runId = await input.launchAutomation(match.automation.id);
      if (runId === null) {
        await updateAutomationTriggerDispatch({
          id: dispatchId,
          status: "skipped",
          error: "Automation did not launch.",
        });
        continue;
      }
      await updateAutomationTriggerDispatch({
        id: dispatchId,
        status: "launched",
        automationRunId: runId,
      });
    } catch (error) {
      await updateAutomationTriggerDispatch({
        id: dispatchId,
        status: "error",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
