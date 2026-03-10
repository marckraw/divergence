import { describe, expect, it } from "vitest";
import { buildAgentConversationContextSummary } from "./agentConversationContext.pure";

describe("agentConversationContext.pure", () => {
  it("returns unavailable summary for non-codex providers", () => {
    const summary = buildAgentConversationContextSummary({
      provider: "claude",
      conversationContext: null,
    });

    expect(summary.label).toBe("Not available yet");
    expect(summary.isAvailable).toBe(false);
  });

  it("returns waiting summary when codex has not reported context yet", () => {
    const summary = buildAgentConversationContextSummary({
      provider: "codex",
      conversationContext: null,
    });

    expect(summary.label).toBe("Waiting for context");
    expect(summary.isAvailable).toBe(false);
  });

  it("formats available codex context and tone", () => {
    const summary = buildAgentConversationContextSummary({
      provider: "codex",
      conversationContext: {
        status: "available",
        label: "7% left",
        fractionUsed: 0.93,
        fractionRemaining: 0.07,
        detail: "Current conversation context remaining.",
        source: "codex",
      },
    });

    expect(summary.label).toBe("7% left");
    expect(summary.isAvailable).toBe(true);
    expect(summary.tone).toBe("danger");
    expect(summary.fractionUsed).toBe(0.93);
  });

  it("falls back to unavailable when codex data is incomplete", () => {
    const summary = buildAgentConversationContextSummary({
      provider: "codex",
      conversationContext: {
        status: "unavailable",
        label: "Unavailable",
        source: "codex",
      },
    });

    expect(summary.label).toBe("Unavailable");
    expect(summary.isAvailable).toBe(false);
  });
});
