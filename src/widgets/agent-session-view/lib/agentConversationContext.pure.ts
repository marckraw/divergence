import type { AgentSessionSnapshot } from "../../../entities";
import { getAgentProviderLabel } from "../../../shared";

export type AgentConversationContextTone = "neutral" | "warning" | "danger";

export interface AgentConversationContextSummary {
  label: string;
  detail: string;
  isAvailable: boolean;
  fractionUsed: number | null;
  fractionRemaining: number | null;
  tone: AgentConversationContextTone;
}

function clampFraction(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function formatPercentLabel(fractionRemaining: number): string {
  return `${Math.round(clampFraction(fractionRemaining) * 100)}% left`;
}

export function buildAgentConversationContextSummary(
  session: Pick<AgentSessionSnapshot, "provider" | "conversationContext">,
): AgentConversationContextSummary {
  if (session.provider !== "codex") {
    const providerLabel = getAgentProviderLabel(session.provider);
    return {
      label: "Not available yet",
      detail: `${providerLabel} does not expose current conversation context in Divergence yet.`,
      isAvailable: false,
      fractionUsed: null,
      fractionRemaining: null,
      tone: "neutral",
    };
  }

  const context = session.conversationContext;
  if (!context) {
    return {
      label: "Waiting for context",
      detail: "Codex has not reported current conversation context for this thread yet.",
      isAvailable: false,
      fractionUsed: null,
      fractionRemaining: null,
      tone: "neutral",
    };
  }

  const fractionUsed = context.fractionUsed ?? (
    context.fractionRemaining !== null && context.fractionRemaining !== undefined
      ? 1 - context.fractionRemaining
      : null
  );
  const fractionRemaining = context.fractionRemaining ?? (
    context.fractionUsed !== null && context.fractionUsed !== undefined
      ? 1 - context.fractionUsed
      : null
  );

  if (context.status !== "available" || fractionUsed === null || fractionRemaining === null) {
    return {
      label: context.label || "Unavailable",
      detail: context.detail || "Codex did not provide a usable conversation-context update.",
      isAvailable: false,
      fractionUsed: null,
      fractionRemaining: null,
      tone: "neutral",
    };
  }

  const normalizedUsed = clampFraction(fractionUsed);
  const normalizedRemaining = clampFraction(fractionRemaining);
  const tone = normalizedUsed >= 0.9
    ? "danger"
    : normalizedUsed >= 0.75
      ? "warning"
      : "neutral";

  return {
    label: context.label || formatPercentLabel(normalizedRemaining),
    detail: context.detail || "Current conversation context remaining.",
    isAvailable: true,
    fractionUsed: normalizedUsed,
    fractionRemaining: normalizedRemaining,
    tone,
  };
}
