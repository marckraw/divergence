import type { AgentSession, AgentSessionSnapshot } from "../model/agentSession.types";

export function createEmptyAgentSessionSnapshot(session: AgentSession): AgentSessionSnapshot {
  return {
    ...session,
    messages: [],
    activities: [],
    pendingRequest: null,
    errorMessage: null,
  };
}

export function getAgentSessionTimestamp(session: Pick<AgentSession, "updatedAtMs" | "createdAtMs">): number {
  return Math.max(session.updatedAtMs, session.createdAtMs);
}

export function createAgentSessionLabel(
  baseName: string,
  provider: AgentSession["provider"],
  role: AgentSession["sessionRole"]
): string {
  if (role === "review-agent") {
    return `${baseName} • ${provider} review`;
  }
  if (role === "manual") {
    return `${baseName} • ${provider}`;
  }
  return `${baseName} • ${provider}`;
}
