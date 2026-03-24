import { describe, expect, it } from "vitest";
import type { AgentProposedPlan } from "../../../entities";
import {
  buildProposedPlanImplementationPrompt,
  buildProposedPlanSavePath,
  findProposedPlanForMessage,
  getLatestProposedPlan,
  getProposedPlanStatusLabel,
} from "./agentProposedPlan.pure";

function makePlan(partial: Partial<AgentProposedPlan> = {}): AgentProposedPlan {
  return {
    id: partial.id ?? "plan-1",
    sourceMessageId: partial.sourceMessageId ?? "assistant-1",
    sourceTurnInteractionMode: "plan",
    title: partial.title ?? "Ship search polish",
    planMarkdown: partial.planMarkdown ?? "1. Update the composer",
    status: partial.status ?? "proposed",
    createdAtMs: partial.createdAtMs ?? 1_700_000_000_000,
    updatedAtMs: partial.updatedAtMs ?? 1_700_000_000_000,
    implementedAtMs: partial.implementedAtMs ?? null,
    implementationSessionId: partial.implementationSessionId ?? null,
  };
}

describe("agentProposedPlan.pure", () => {
  it("finds the proposed plan for an assistant message", () => {
    const proposedPlan = makePlan({ id: "plan-2", sourceMessageId: "assistant-2" });
    const result = findProposedPlanForMessage([
      makePlan(),
      proposedPlan,
    ], "assistant-2");

    expect(result).toEqual(proposedPlan);
    expect(findProposedPlanForMessage([makePlan()], "missing")).toBeNull();
  });

  it("returns the latest still-proposed plan", () => {
    const latestPlan = makePlan({ id: "plan-latest", updatedAtMs: 300 });
    const result = getLatestProposedPlan([
      makePlan({ id: "plan-old", updatedAtMs: 100 }),
      makePlan({ id: "plan-implemented", status: "implemented", updatedAtMs: 400 }),
      latestPlan,
    ]);

    expect(result).toEqual(latestPlan);
  });

  it("maps proposed plan statuses to UI labels", () => {
    expect(getProposedPlanStatusLabel(makePlan({ status: "proposed" }))).toBe("Proposed");
    expect(getProposedPlanStatusLabel(makePlan({ status: "implemented" }))).toBe("Implemented");
    expect(getProposedPlanStatusLabel(makePlan({ status: "dismissed" }))).toBe("Dismissed");
  });

  it("builds a workspace save path with a slugged title", () => {
    const path = buildProposedPlanSavePath("/workspace/repo", makePlan({
      title: "Ship Search Polish!",
    }));

    expect(path).toMatch(/^\/workspace\/repo\/proposed-plan-ship-search-polish-\d{8}-\d{4}\.md$/);
  });

  it("builds an implementation prompt from the plan title when available", () => {
    expect(buildProposedPlanImplementationPrompt(makePlan({
      title: "  Stabilize timeline plan cards  ",
    }))).toBe('Implement the proposed plan "Stabilize timeline plan cards".');

    expect(buildProposedPlanImplementationPrompt(makePlan({
      title: "   ",
    }))).toBe("Implement the proposed plan.");
  });
});
