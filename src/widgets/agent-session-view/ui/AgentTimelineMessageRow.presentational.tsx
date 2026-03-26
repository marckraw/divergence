import { Markdown, formatMessageTime } from "../../../shared";
import AttachmentChip from "./AttachmentChip.presentational";
import type { AgentMessage } from "../../../entities";

function formatAttachmentSize(sizeBytes: number): string {
  if (sizeBytes < 1024) {
    return `${sizeBytes} B`;
  }
  if (sizeBytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(sizeBytes / 102.4) / 10)} KB`;
  }
  return `${Math.round(sizeBytes / (1024 * 102.4)) / 10} MB`;
}

interface AgentTimelineMessageRowProps {
  message: AgentMessage;
}

function AgentTimelineMessageRow({ message }: AgentTimelineMessageRowProps) {
  const isUser = message.role === "user";
  const displayContent = message.content || (message.status === "streaming" ? "Working..." : "");

  return (
    <div
      className={`rounded-2xl border px-3 py-3 shadow-[0_24px_70px_-58px_rgba(0,0,0,0.95)] sm:px-4 sm:py-4 ${
        isUser
          ? "ml-auto w-full max-w-3xl border-accent/25 bg-accent/10"
          : "mr-auto w-full border-surface/80 bg-sidebar/85"
      }`}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-[0.18em] text-subtext">{message.role}</span>
          {message.interactionMode === "plan" ? (
            <span className="rounded-full border border-yellow/30 bg-yellow/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-yellow">
              Plan
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          {message.createdAtMs > 0 ? (
            <span className="text-[10px] text-subtext/60" title={new Date(message.createdAtMs).toLocaleString()}>
              {formatMessageTime(message.createdAtMs)}
            </span>
          ) : null}
          <span className="text-[11px] text-subtext">{message.status}</span>
        </div>
      </div>

      {message.attachments && message.attachments.length > 0 ? (
        <div className="mb-3 flex flex-wrap gap-2">
          {message.attachments.map((attachment) => (
            <AttachmentChip
              key={attachment.id}
              attachment={attachment}
              secondaryLabel={formatAttachmentSize(attachment.sizeBytes)}
            />
          ))}
        </div>
      ) : null}

      {isUser ? (
        <div className="whitespace-pre-wrap break-words text-sm leading-7 text-text">{displayContent}</div>
      ) : (
        <Markdown content={displayContent} className="text-text" />
      )}
    </div>
  );
}

export default AgentTimelineMessageRow;
