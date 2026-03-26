import { Button } from "../../../shared";

interface AgentSessionComposerFooterProps {
  pendingRequestLabel: string | null;
  interactionModeLabel: string;
  isSubmitting: boolean;
  isStagingAttachment: boolean;
  isRunning: boolean;
  canSubmit: boolean;
  onSubmit: () => void;
}

function AgentSessionComposerFooter({
  pendingRequestLabel,
  interactionModeLabel,
  isSubmitting,
  isStagingAttachment,
  isRunning,
  canSubmit,
  onSubmit,
}: AgentSessionComposerFooterProps) {
  return (
    <div className="flex items-center justify-between gap-3">
      <p className="text-xs text-subtext">
        {pendingRequestLabel
          ? `Waiting on ${pendingRequestLabel}`
          : `Runtime prompt input. ${interactionModeLabel} Shift+Tab toggles mode. Cmd/Ctrl+Enter to send`}
      </p>
      {!pendingRequestLabel ? (
        <Button
          type="button"
          onClick={onSubmit}
          disabled={isSubmitting || isStagingAttachment || isRunning || !canSubmit}
        >
          {isRunning ? "Running..." : interactionModeLabel.includes("Plan") ? "Plan" : "Send"}
        </Button>
      ) : null}
    </div>
  );
}

export default AgentSessionComposerFooter;
