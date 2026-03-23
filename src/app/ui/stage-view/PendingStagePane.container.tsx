import { Button, Kbd } from "../../../shared";

interface PendingStagePaneProps {
  onOpenCommandCenter: () => void;
  onClose: () => void;
}

function PendingStagePane({ onOpenCommandCenter, onClose }: PendingStagePaneProps) {
  return (
    <div className="flex h-full items-center justify-center bg-sidebar/30">
      <div className="text-center space-y-3">
        <div className="text-subtext text-sm">Empty pane</div>
        <Button variant="ghost" onClick={onOpenCommandCenter}>
          Open something here
        </Button>
        <div className="text-xs text-subtext">
          Press <Kbd>Cmd+K</Kbd> to search
        </div>
        <div className="pt-2">
          <Button variant="ghost" size="sm" onClick={onClose} className="text-xs text-subtext">
            Close pane
          </Button>
        </div>
      </div>
    </div>
  );
}

export default PendingStagePane;
