import { Button, Markdown } from "../../../shared";
import type { AgentProposedPlan } from "../../../entities";
import { getProposedPlanStatusLabel } from "../lib/agentProposedPlan.pure";

interface AgentProposedPlanCardPresentationalProps {
  plan: AgentProposedPlan;
  isExpanded: boolean;
  isCopying: boolean;
  isSaving: boolean;
  isQueued: boolean;
  onToggleExpanded: () => void;
  onCopy: () => void;
  onSave: () => void;
  onImplement: () => void;
}

function AgentProposedPlanCardPresentational({
  plan,
  isExpanded,
  isCopying,
  isSaving,
  isQueued,
  onToggleExpanded,
  onCopy,
  onSave,
  onImplement,
}: AgentProposedPlanCardPresentationalProps) {
  const canImplement = plan.status === "proposed";

  return (
    <div className="mr-auto w-full max-w-[70rem] rounded-2xl border border-yellow/30 bg-yellow/10 px-4 py-4 shadow-[0_24px_70px_-58px_rgba(0,0,0,0.95)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.18em] text-yellow">
            Proposed Plan
          </p>
          <h3 className="mt-1 text-base font-semibold text-text">
            {plan.title?.trim() || "Actionable plan"}
          </h3>
        </div>
        <span className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] ${
          plan.status === "implemented"
            ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
            : plan.status === "dismissed"
              ? "border-surface/80 bg-main/60 text-subtext"
              : "border-yellow/30 bg-yellow/10 text-yellow"
        }`}
        >
          {getProposedPlanStatusLabel(plan)}
        </span>
      </div>

      <div className="mt-4 rounded-xl border border-surface/80 bg-sidebar/70 p-4">
        <div className={isExpanded ? "" : "max-h-[20rem] overflow-hidden"}>
          <Markdown content={plan.planMarkdown} className="text-text" />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onToggleExpanded}
          >
            {isExpanded ? "Collapse" : "Expand"}
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={onCopy}>
            {isCopying ? "Copied" : "Copy"}
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={onSave} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save to Workspace"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onImplement}
            disabled={!canImplement}
          >
            {isQueued ? "Queued" : "Implement Plan"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default AgentProposedPlanCardPresentational;
