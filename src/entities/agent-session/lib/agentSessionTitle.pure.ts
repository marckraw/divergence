import type { AgentSessionSnapshot } from "../model/agentSession.types";

const MAX_TITLE_LENGTH = 56;

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function stripMarkdownNoise(value: string): string {
  return value
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]+`/g, " ")
    .replace(/!\[[^\]]*\]\([^)]+\)/g, " ")
    .replace(/@\S+/g, " ");
}

function splitIntoClauses(value: string): string[] {
  return stripMarkdownNoise(value)
    .split(/[\n.!?]+/g)
    .map((part) => normalizeWhitespace(part))
    .filter(Boolean);
}

function stripLeadIns(value: string): string {
  return value
    .replace(/^(?:hey|hi|hello|yo|ok|okay|nice|cool|thanks|thank you)\b[\s,.:;-]*/i, "")
    .replace(/^(?:can|could|would)\s+you\s+/i, "")
    .replace(/^please\s+/i, "")
    .replace(/^i\s+(?:want|need)\s+you\s+to\s+/i, "")
    .replace(/^let'?s\s+/i, "")
    .replace(/^take\s+a\s+look\s+at\s+/i, "Look at ");
}

function looksTooGeneric(value: string): boolean {
  const normalized = value.toLowerCase();
  return normalized.length < 8
    || /^(what'?s up|whats up|who are you|what can you do|help|hello|hi|hey)$/.test(normalized);
}

function toSentenceCase(value: string): string {
  if (!value) {
    return value;
  }
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function truncateAtWordBoundary(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  const truncated = value.slice(0, maxLength + 1);
  const boundaryIndex = truncated.lastIndexOf(" ");
  const safe = boundaryIndex > Math.floor(maxLength * 0.6)
    ? truncated.slice(0, boundaryIndex)
    : truncated.slice(0, maxLength);
  return `${safe.trimEnd()}…`;
}

function buildTitleCandidate(value: string): string | null {
  const stripped = normalizeWhitespace(stripLeadIns(value)).replace(/^[-:]+/, "").trim();
  if (looksTooGeneric(stripped)) {
    return null;
  }

  return truncateAtWordBoundary(toSentenceCase(stripped), MAX_TITLE_LENGTH);
}

export function suggestAgentSessionTitle(
  session: Pick<AgentSessionSnapshot, "messages">,
): string | null {
  for (const message of session.messages) {
    if (message.role !== "user") {
      continue;
    }

    for (const clause of splitIntoClauses(message.content)) {
      const candidate = buildTitleCandidate(clause);
      if (candidate) {
        return candidate;
      }
    }
  }

  return null;
}
