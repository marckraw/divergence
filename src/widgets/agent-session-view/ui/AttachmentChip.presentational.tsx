import { Paperclip, X } from "lucide-react";
import { IconButton } from "../../../shared";
import type { AgentSessionComposerAttachment } from "./AgentSessionView.types";

interface AttachmentChipProps {
  attachment: AgentSessionComposerAttachment;
  secondaryLabel?: string;
  kindLabel?: string;
  onRemove?: () => void;
}

function AttachmentChip({
  attachment,
  secondaryLabel,
  kindLabel,
  onRemove,
}: AttachmentChipProps) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-surface/80 bg-main/60 px-3 py-1 text-[11px] text-subtext">
      <Paperclip className="h-3.5 w-3.5" />
      <span className="max-w-[18rem] truncate">{attachment.name}</span>
      {secondaryLabel ? <span>{secondaryLabel}</span> : null}
      {kindLabel ? (
        <span className="rounded-full border border-surface/80 bg-sidebar/70 px-1.5 py-0.5 text-[10px] uppercase tracking-[0.16em] text-subtext">
          {kindLabel}
        </span>
      ) : null}
      {onRemove ? (
        <IconButton
          type="button"
          variant="ghost"
          size="xs"
          icon={<X className="h-3.5 w-3.5" />}
          label={`Remove ${attachment.name}`}
          onClick={onRemove}
        />
      ) : null}
    </div>
  );
}

export default AttachmentChip;
