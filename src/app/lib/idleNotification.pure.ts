import type { TerminalSession } from "../../entities";

export interface ShouldNotifyIdleInput {
  sessionExists: boolean;
  sessionStatus: TerminalSession["status"] | null;
  durationMs: number;
  notifyMinBusyMs: number;
  nowMs: number;
  lastNotifiedAtMs: number;
  notifyCooldownMs: number;
  isWindowFocused: boolean;
  isSessionActive: boolean;
}

export function shouldNotifyIdle(input: ShouldNotifyIdleInput): boolean {
  if (!input.sessionExists || input.sessionStatus !== "idle") {
    return false;
  }

  if (input.durationMs < input.notifyMinBusyMs) {
    return false;
  }

  if (input.nowMs - input.lastNotifiedAtMs < input.notifyCooldownMs) {
    return false;
  }

  if (input.isWindowFocused && input.isSessionActive) {
    return false;
  }

  return true;
}

export function buildIdleNotificationTargetLabel(
  session: Pick<TerminalSession, "type" | "name">,
  projectName: string
): string {
  if (session.type === "divergence") {
    return `${projectName} / ${session.name}`;
  }
  return projectName;
}
