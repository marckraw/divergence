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
      <div className="text-center space-y-3">
        <div className="text-subtext text-sm">Empty pane</div>
        <Button variant="ghost" onClick={onOpenCommandCenter}>
          Open something here
        </Button>
        <div className="text-xs text-subtext">
          Press <Kbd>Cmd+K</Kbd> to search
        </div>
        <div className="pt-2">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Close pane
          </Button>
        </div>
      </div>
    </div>
  );
}

export default PendingStagePane;
