import { updateAutomationRun } from "../../../entities/automation";
import { killAutomationTmuxSession } from "../api/tmuxAutomation.api";

export async function cancelAutomationRun(
  runId: number,
  tmuxSessionName: string
): Promise<void> {
  try {
    await killAutomationTmuxSession(tmuxSessionName);
  } catch (error) {
    console.warn(`Failed to kill tmux session ${tmuxSessionName}:`, error);
  }

  await updateAutomationRun(runId, {
    status: "cancelled",
    endedAtMs: Date.now(),
    error: "Cancelled by user.",
  });
}
