import { postCloudNotification } from "../../../shared/api/cloudNotifications.api";
import type { AutomationResultFile } from "../lib/tmuxAutomation.types";

/**
 * Sends a push notification to mobile devices when an automation run completes.
 * Silently fails if cloud config is missing — notifications are best-effort.
 */
export async function notifyAutomationCompletion(input: {
  cloudApiBaseUrl: string | null | undefined;
  cloudApiToken: string | null | undefined;
  runId: number;
  automationName?: string;
  status: "success" | "error";
  result?: AutomationResultFile;
  errorMessage?: string;
}): Promise<void> {
  if (!input.cloudApiBaseUrl || !input.cloudApiToken) {
    return; // Cloud not configured — skip silently
  }

  const title =
    input.status === "success"
      ? `Automation completed: ${input.automationName ?? `Run #${input.runId}`}`
      : `Automation failed: ${input.automationName ?? `Run #${input.runId}`}`;

  const body =
    input.status === "success"
      ? `Run #${input.runId} finished successfully.`
      : `Run #${input.runId} failed: ${input.errorMessage ?? "Unknown error"}`;

  try {
    await postCloudNotification({
      baseUrl: input.cloudApiBaseUrl,
      cloudApiToken: input.cloudApiToken,
      kind: "automation_finished",
      title,
      body,
      payload: {
        runId: input.runId,
        status: input.status,
        exitCode: input.result?.exitCode,
      },
    });
  } catch (error) {
    // Best-effort: log but don't throw
    console.warn(
      `[notification] Failed to send automation completion notification for run ${input.runId}:`,
      error instanceof Error ? error.message : error,
    );
  }
}
