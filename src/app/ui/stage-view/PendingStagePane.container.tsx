import { Button, Kbd } from "../../../shared";

interface PendingStagePaneProps {
  onOpenCommandCenter: () => void;
  onClose: () => void;
}

function PendingStagePane({
  onOpenCommandCenter,
  onClose,
}: PendingStagePaneProps) {
  return (
    <div className="flex h-full min-h-0 items-center justify-center bg-sidebar/30 p-5">
      <div className="w-full max-w-md rounded-3xl border border-surface bg-main/90 p-8 text-center shadow-[0_24px_80px_-52px_rgba(0,0,0,0.95)]">
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-subtext">
          Empty Pane
        </div>
        <h2 className="mt-3 text-xl font-semibold text-text">Open something here</h2>
        <p className="mt-2 text-sm leading-6 text-subtext">
          Use the unified command center to search files, jump to sessions, or create a new terminal or agent in this pane.
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <Button type="button" onClick={onOpenCommandCenter}>
            Open Command Center
          </Button>
          <Button type="button" variant="ghost" onClick={onClose}>
            Close pane
          </Button>
        </div>
        <div className="mt-5 text-xs text-subtext">
          Press <Kbd>cmd</Kbd> + <Kbd>k</Kbd> while this pane is focused.
        </div>
      </div>
    </div>
  );
}

export default PendingStagePane;
