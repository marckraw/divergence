import type { AgentRequest } from "../../../entities/agent-session";
import { Button } from "../../../shared";

interface AgentPendingApprovalBarProps {
  request: AgentRequest;
  isResolving: boolean;
  onResolve: (decisionId: string) => void;
}

function AgentPendingApprovalBar({
  request,
  isResolving,
  onResolve,
}: AgentPendingApprovalBarProps) {
  return (
    <div className="border-b border-surface bg-sidebar/40 px-5 py-4">
      <div className="mx-auto mt-0 flex w-full max-w-5xl flex-wrap gap-2">
        {(request.options ?? []).map((option) => (
          <Button
            key={option.id}
            type="button"
            variant={option.id.includes("decline") || option.id.includes("cancel") ? "ghost" : "secondary"}
            size="sm"
            onClick={() => onResolve(option.id)}
            disabled={isResolving}
            title={option.description}
          >
            {option.label}
          </Button>
        ))}
      </div>
    </div>
  );
}

export default AgentPendingApprovalBar;
