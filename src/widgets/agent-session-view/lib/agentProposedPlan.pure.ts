import { joinPath } from "../../../shared";
import type { AgentProposedPlan } from "../../../entities";

function slugifyPlanSegment(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function formatPlanTimestamp(createdAtMs: number): string {
  const date = new Date(createdAtMs);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}${month}${day}-${hours}${minutes}`;
}

export function findProposedPlanForMessage(
  proposedPlans: AgentProposedPlan[],
  sourceMessageId: string,
): AgentProposedPlan | null {
  return proposedPlans.find((plan) => plan.sourceMessageId === sourceMessageId) ?? null;
}

export function getLatestProposedPlan(proposedPlans: AgentProposedPlan[]): AgentProposedPlan | null {
  return proposedPlans
    .filter((plan) => plan.status === "proposed")
    .sort((left, right) => right.updatedAtMs - left.updatedAtMs)[0] ?? null;
}

export function getProposedPlanStatusLabel(plan: AgentProposedPlan): string {
  switch (plan.status) {
    case "implemented":
      return "Implemented";
    case "dismissed":
      return "Dismissed";
    case "proposed":
    default:
      return "Proposed";
  }
}

export function buildProposedPlanSavePath(
  workspacePath: string,
  plan: AgentProposedPlan,
): string {
  const titleSegment = slugifyPlanSegment(plan.title ?? "");
  const filename = [
    "proposed-plan",
    titleSegment || "agent-plan",
    formatPlanTimestamp(plan.createdAtMs),
  ].join("-");
  return joinPath(workspacePath, `${filename}.md`);
}

export function buildProposedPlanImplementationPrompt(plan: AgentProposedPlan): string {
  if (plan.title?.trim()) {
    return `Implement the proposed plan "${plan.title.trim()}".`;
  }

  return "Implement the proposed plan.";
}
