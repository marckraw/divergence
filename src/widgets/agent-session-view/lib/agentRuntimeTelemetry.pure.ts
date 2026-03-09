import type { AgentRuntimeDebugEvent, AgentSessionSnapshot } from "../../../entities";

export interface AgentRuntimeTelemetrySummary {
  phaseLabel: string;
  elapsedLabel: string | null;
  lastEventLabel: string | null;
  latestEventMessage: string | null;
  slowWarning: string | null;
}

export function formatRuntimeDuration(durationMs: number): string {
  const clampedMs = Math.max(0, durationMs);
  const totalSeconds = Math.floor(clampedMs / 1000);

  if (totalSeconds < 60) {
    return `${totalSeconds}s`;
  }

  const totalMinutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (totalMinutes < 60) {
    return seconds === 0 ? `${totalMinutes}m` : `${totalMinutes}m ${seconds}s`;
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
}

export function formatRuntimeEventOffset(
  eventAtMs: number,
  turnStartedAtMs?: number | null,
): string {
  if (!turnStartedAtMs) {
    return "+0s";
  }

  return `+${formatRuntimeDuration(eventAtMs - turnStartedAtMs)}`;
}

export function getLatestRuntimeEvent(
  runtimeEvents: AgentRuntimeDebugEvent[],
): AgentRuntimeDebugEvent | null {
  if (runtimeEvents.length === 0) {
    return null;
  }

  return runtimeEvents[runtimeEvents.length - 1] ?? null;
}

export function buildAgentRuntimeTelemetrySummary(
  session: Pick<
    AgentSessionSnapshot,
    "currentTurnStartedAtMs" | "lastRuntimeEventAtMs" | "runtimeEvents" | "runtimePhase" | "runtimeStatus" | "model"
  >,
  nowMs: number,
): AgentRuntimeTelemetrySummary {
  const latestEvent = getLatestRuntimeEvent(session.runtimeEvents);
  const elapsedLabel = session.currentTurnStartedAtMs
    ? formatRuntimeDuration(nowMs - session.currentTurnStartedAtMs)
    : null;
  const lastEventLabel = session.lastRuntimeEventAtMs
    ? formatRuntimeDuration(nowMs - session.lastRuntimeEventAtMs)
    : null;
  const phaseLabel = session.runtimePhase
    ?? latestEvent?.phase
    ?? (session.runtimeStatus === "running" ? "Running" : session.runtimeStatus);
  const hasBeenQuietForAWhile = session.lastRuntimeEventAtMs !== null
    && session.lastRuntimeEventAtMs !== undefined
    && (session.runtimeStatus === "running" || session.runtimeStatus === "waiting")
    && nowMs - session.lastRuntimeEventAtMs >= 10_000;

  return {
    phaseLabel,
    elapsedLabel,
    lastEventLabel,
    latestEventMessage: latestEvent?.message ?? null,
    slowWarning: hasBeenQuietForAWhile ? `Still waiting on ${session.model}.` : null,
  };
}
