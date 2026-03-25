import { memo, useState } from "react";
import { Paperclip } from "lucide-react";
import { Virtuoso } from "react-virtuoso";
import { Button, EmptyState, formatMessageTime, Markdown, writeTextFile } from "../../../shared";
import type { AgentActivity, AgentMessage, AgentProposedPlan } from "../../../entities";
import {
  buildProposedPlanSavePath,
  findProposedPlanForMessage,
} from "../lib/agentProposedPlan.pure";
import type { AgentTimelineItem } from "../lib/agentTimeline.pure";
import type { AgentSessionTimelineProps } from "./AgentSessionView.types";
import AgentProposedPlanCardPresentational from "./AgentProposedPlanCard.presentational";

function getActivityToneClass(status: "running" | "completed" | "error") {
  switch (status) {
    case "running":
      return "border-yellow/30 bg-yellow/10 text-yellow";
    case "error":
      return "border-red/30 bg-red/10 text-red";
    case "completed":
    default:
      return "border-surface bg-surface/50 text-subtext";
  }
}

function formatAttachmentSize(sizeBytes: number): string {
  if (sizeBytes < 1024) {
    return `${sizeBytes} B`;
  }
  if (sizeBytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(sizeBytes / 102.4) / 10)} KB`;
  }
  return `${Math.round(sizeBytes / (1024 * 102.4)) / 10} MB`;
}

function areMessageAttachmentsEqual(
  left: AgentMessage["attachments"],
  right: AgentMessage["attachments"],
): boolean {
  if (left === right) {
    return true;
  }
  if (!left || !right) {
    return !left && !right;
  }
  if (left.length !== right.length) {
    return false;
  }
  return left.every((attachment, index) => {
    const next = right[index];
    return next
      && attachment.id === next.id
      && attachment.name === next.name
      && attachment.sizeBytes === next.sizeBytes
      && attachment.kind === next.kind
      && attachment.mimeType === next.mimeType;
  });
}

function areMessagesEqual(left: AgentMessage, right: AgentMessage): boolean {
  return left.id === right.id
    && left.role === right.role
    && left.content === right.content
    && left.status === right.status
    && left.createdAtMs === right.createdAtMs
    && left.interactionMode === right.interactionMode
    && areMessageAttachmentsEqual(left.attachments, right.attachments);
}

function areActivitiesEqual(left: AgentActivity, right: AgentActivity): boolean {
  return left.id === right.id
    && left.kind === right.kind
    && left.title === right.title
    && left.summary === right.summary
    && left.subject === right.subject
    && left.groupKey === right.groupKey
    && left.status === right.status
    && left.details === right.details
    && left.startedAtMs === right.startedAtMs
    && left.completedAtMs === right.completedAtMs;
}

function areProposedPlansEqual(
  left: AgentProposedPlan | null,
  right: AgentProposedPlan | null,
): boolean {
  if (left === right) {
    return true;
  }
  if (!left || !right) {
    return !left && !right;
  }

  return left.id === right.id
    && left.status === right.status
    && left.title === right.title
    && left.planMarkdown === right.planMarkdown
    && left.updatedAtMs === right.updatedAtMs
    && left.implementedAtMs === right.implementedAtMs
    && left.implementationSessionId === right.implementationSessionId;
}

const AgentTimelineMessageRow = memo(function AgentTimelineMessageRow({
  message,
  proposedPlan,
  isCopyingPlan,
  isSavingPlan,
  isQueuedPlan,
  onCopyPlan,
  onSavePlan,
  onImplementPlan,
}: {
  message: AgentMessage;
  proposedPlan: AgentProposedPlan | null;
  isCopyingPlan: boolean;
  isSavingPlan: boolean;
  isQueuedPlan: boolean;
  onCopyPlan: (plan: AgentProposedPlan) => void;
  onSavePlan: (plan: AgentProposedPlan) => void;
  onImplementPlan: (plan: AgentProposedPlan) => void;
}) {
  const [isExpandedPlan, setIsExpandedPlan] = useState(false);
  const isUser = message.role === "user";
  const displayContent = message.content || (message.status === "streaming" ? "Working..." : "");

  if (proposedPlan) {
    return (
      <AgentProposedPlanCardPresentational
        plan={proposedPlan}
        isExpanded={isExpandedPlan}
        isCopying={isCopyingPlan}
        isSaving={isSavingPlan}
        isQueued={isQueuedPlan}
        onToggleExpanded={() => {
          setIsExpandedPlan((previous) => !previous);
        }}
        onCopy={() => onCopyPlan(proposedPlan)}
        onSave={() => onSavePlan(proposedPlan)}
        onImplement={() => onImplementPlan(proposedPlan)}
      />
    );
  }

  return (
    <div
      className={`rounded-2xl border px-4 py-4 shadow-[0_24px_70px_-58px_rgba(0,0,0,0.95)] ${
        isUser
          ? "ml-auto w-full max-w-3xl border-accent/25 bg-accent/10"
          : "mr-auto w-full max-w-[70rem] border-surface/80 bg-sidebar/85"
      }`}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-[0.18em] text-subtext">
            {message.role}
          </span>
          {message.interactionMode === "plan" && (
            <span className="rounded-full border border-yellow/30 bg-yellow/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-yellow">
              Plan
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {message.createdAtMs > 0 && (
            <span className="text-[10px] text-subtext/60" title={new Date(message.createdAtMs).toLocaleString()}>
              {formatMessageTime(message.createdAtMs)}
            </span>
          )}
          <span className="text-[11px] text-subtext">{message.status}</span>
        </div>
      </div>

      {message.attachments && message.attachments.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {message.attachments.map((attachment) => (
            <span
              key={attachment.id}
              className="inline-flex items-center gap-2 rounded-full border border-surface/80 bg-main/60 px-3 py-1 text-[11px] text-subtext"
            >
              <Paperclip className="h-3.5 w-3.5" />
              <span className="max-w-[18rem] truncate">{attachment.name}</span>
              <span>{formatAttachmentSize(attachment.sizeBytes)}</span>
            </span>
          ))}
        </div>
      )}

      {isUser ? (
        <div className="whitespace-pre-wrap break-words text-sm leading-7 text-text">
          {displayContent}
        </div>
      ) : (
        <Markdown content={displayContent} className="text-text" />
      )}
    </div>
  );
}, (previous, next) => (
  areMessagesEqual(previous.message, next.message)
  && areProposedPlansEqual(previous.proposedPlan, next.proposedPlan)
  && previous.isCopyingPlan === next.isCopyingPlan
  && previous.isSavingPlan === next.isSavingPlan
  && previous.isQueuedPlan === next.isQueuedPlan
));

function formatActivityKind(kind: string): string {
  return kind.replace(/_/g, " ");
}

function AgentTimelineActivityStep({
  activity,
}: {
  activity: AgentActivity;
}) {
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const summary = activity.summary || activity.title;

  return (
    <div className="min-w-0 rounded-md border border-surface/60 bg-main/20 px-2 py-1">
      <div className="flex min-w-0 items-center gap-2">
        <span className="shrink-0 rounded-full border border-surface/80 px-1.5 py-0.5 text-[8px] uppercase tracking-[0.14em] text-subtext/80">
          {formatActivityKind(activity.kind)}
        </span>
        <p className="min-w-0 flex-1 truncate text-[12px] leading-4 text-subtext">
          {summary}
        </p>
        <span className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[8px] uppercase tracking-[0.14em] ${getActivityToneClass(activity.status)}`}>
          {activity.status}
        </span>
        {activity.details && (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className="h-auto shrink-0 px-1 py-0 text-[9px] text-subtext/80 hover:text-text"
            onClick={() => {
              setIsDetailsOpen((previous) => !previous);
            }}
          >
            {isDetailsOpen ? "Hide" : "Details"}
          </Button>
        )}
      </div>
      {activity.details && isDetailsOpen && (
        <pre className="mt-1.5 overflow-x-auto rounded-lg border border-surface/80 bg-main/80 p-2 whitespace-pre-wrap break-words font-mono text-[11px] leading-5 text-subtext">
          {activity.details}
        </pre>
      )}
    </div>
  );
}

function AgentTimelineActivityRow({
  activity,
  summary,
}: {
  activity: AgentActivity;
  summary: string;
}) {
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  return (
    <div className="mr-auto flex w-full max-w-[58rem] gap-2 pl-0.5">
      <div className="relative flex w-3 shrink-0 justify-center">
        <div className="absolute inset-y-0 w-px bg-surface/40" />
        <div className={`relative mt-2.5 h-1 w-1 rounded-full opacity-65 ${
          activity.status === "error"
            ? "bg-red"
            : activity.status === "running"
              ? "bg-yellow"
              : "bg-accent"
        }`}
        />
      </div>

      <div className="min-w-0 flex-1 rounded-lg border border-surface/80 bg-sidebar/45 px-3 py-1.5">
        <div className="flex min-w-0 items-center gap-2">
          <span className="shrink-0 text-[8px] uppercase tracking-[0.16em] text-subtext">
            Thought Process
          </span>
          <span className="shrink-0 rounded-full border border-surface px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-subtext">
            {formatActivityKind(activity.kind)}
          </span>
          <p className="min-w-0 flex-1 truncate text-sm leading-5 text-text">
            {summary}
          </p>
          <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[9px] uppercase tracking-[0.14em] ${getActivityToneClass(activity.status)}`}>
            {activity.status}
          </span>
          {activity.details && (
            <Button
              type="button"
              variant="ghost"
              size="xs"
              className="h-auto shrink-0 px-1 py-0 text-[10px] text-subtext hover:text-text"
              onClick={() => {
                setIsDetailsOpen((previous) => !previous);
              }}
            >
              {isDetailsOpen ? "Hide" : "Details"}
            </Button>
          )}
        </div>
        {activity.details && isDetailsOpen && (
          <pre className="mt-1.5 overflow-x-auto rounded-lg border border-surface/80 bg-main/80 p-2 whitespace-pre-wrap break-words font-mono text-[11px] leading-5 text-subtext">
            {activity.details}
          </pre>
        )}
      </div>
    </div>
  );
}

const AgentTimelineActivityMemoRow = memo(AgentTimelineActivityRow, (previous, next) => (
  areActivitiesEqual(previous.activity, next.activity)
  && previous.summary === next.summary
));

function AgentTimelineActivityGroupRow({
  activities,
  status,
  summary,
}: {
  activities: AgentActivity[];
  status: AgentActivity["status"];
  summary: string;
}) {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <div className="mr-auto flex w-full max-w-[58rem] gap-2 pl-0.5">
      <div className="relative flex w-3 shrink-0 justify-center">
        <div className="absolute inset-y-0 w-px bg-surface/40" />
        <div className={`relative mt-2.5 h-1 w-1 rounded-full opacity-65 ${
          status === "error"
            ? "bg-red"
            : status === "running"
              ? "bg-yellow"
              : "bg-accent"
        }`}
        />
      </div>

      <div className="min-w-0 flex-1 rounded-lg border border-surface/80 bg-sidebar/45 px-3 py-1.5">
        <div className="flex min-w-0 items-center gap-2">
          <span className="shrink-0 text-[8px] uppercase tracking-[0.16em] text-subtext">
            Thought Process
          </span>
          <span className="shrink-0 rounded-full border border-surface px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-subtext">
            tool burst
          </span>
          <p className="min-w-0 flex-1 truncate text-sm leading-5 text-text">
            {summary}
          </p>
          <span className="shrink-0 rounded-full border border-surface px-2 py-0.5 text-[9px] uppercase tracking-[0.14em] text-subtext">
            {activities.length} steps
          </span>
          <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[9px] uppercase tracking-[0.14em] ${getActivityToneClass(status)}`}>
            {status}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className="h-auto shrink-0 px-1 py-0 text-[10px] text-subtext hover:text-text"
            onClick={() => {
              setIsExpanded((previous) => !previous);
            }}
          >
            {isExpanded ? "Hide" : "Details"}
          </Button>
        </div>
        {isExpanded && (
          <div className="mt-2 space-y-1.5">
            {activities.map((activity) => (
              <AgentTimelineActivityStep key={activity.id} activity={activity} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const AgentTimelineRow = memo(function AgentTimelineRow({
  item,
  session,
  copiedPlanId,
  savingPlanId,
  queuedPlanId,
  onCopyPlan,
  onSavePlan,
  onImplementProposedPlan,
}: {
  item: AgentTimelineItem;
  session: AgentSessionTimelineProps["session"];
  copiedPlanId: string | null;
  savingPlanId: string | null;
  queuedPlanId: string | null;
  onCopyPlan: (plan: AgentProposedPlan) => void;
  onSavePlan: (plan: AgentProposedPlan) => void;
  onImplementProposedPlan: AgentSessionTimelineProps["onImplementProposedPlan"];
}) {
  if (item.kind === "activity_group") {
    return (
      <AgentTimelineActivityGroupRow
        activities={item.activities}
        status={item.status}
        summary={item.summary}
      />
    );
  }

  if (item.kind === "activity") {
    return <AgentTimelineActivityMemoRow activity={item.activity} summary={item.summary} />;
  }

  const proposedPlan = item.message.role === "assistant"
    ? findProposedPlanForMessage(session.proposedPlans, item.message.id)
    : null;

  return (
    <AgentTimelineMessageRow
      message={item.message}
      proposedPlan={proposedPlan}
      isCopyingPlan={proposedPlan?.id === copiedPlanId}
      isSavingPlan={proposedPlan?.id === savingPlanId}
      isQueuedPlan={proposedPlan?.id === queuedPlanId}
      onCopyPlan={onCopyPlan}
      onSavePlan={onSavePlan}
      onImplementPlan={onImplementProposedPlan}
    />
  );
});

function AgentSessionTimelineContainer({
  session,
  timelineItems,
  onImplementProposedPlan,
}: AgentSessionTimelineProps) {
  const [isFollowingOutput, setIsFollowingOutput] = useState(true);
  const [copiedPlanId, setCopiedPlanId] = useState<string | null>(null);
  const [savingPlanId, setSavingPlanId] = useState<string | null>(null);
  const [queuedPlanId, setQueuedPlanId] = useState<string | null>(null);

  const handleCopyPlan = (plan: AgentProposedPlan) => {
    void navigator.clipboard.writeText(plan.planMarkdown);
    setCopiedPlanId(plan.id);
    window.setTimeout(() => {
      setCopiedPlanId((current) => (current === plan.id ? null : current));
    }, 1500);
  };

  const handleSavePlan = (plan: AgentProposedPlan) => {
    setSavingPlanId(plan.id);
    void writeTextFile(
      buildProposedPlanSavePath(session.path, plan),
      plan.planMarkdown,
    ).finally(() => {
      setSavingPlanId((current) => (current === plan.id ? null : current));
    });
  };

  const handleImplementPlan = (plan: AgentProposedPlan) => {
    onImplementProposedPlan(plan);
    setQueuedPlanId(plan.id);
    window.setTimeout(() => {
      setQueuedPlanId((current) => (current === plan.id ? null : current));
    }, 1500);
  };

  if (timelineItems.length === 0) {
    return (
      <div className="flex-1 min-h-0 overflow-y-auto px-5 py-5">
        <div className="mx-auto w-full max-w-5xl space-y-3">
          <EmptyState className="rounded-2xl border border-dashed border-surface bg-sidebar/30 p-10">
            <p>No agent turns yet</p>
            <p className="mt-2 text-xs">Send a prompt to start an agent runtime turn.</p>
          </EmptyState>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 px-5 py-5">
      <Virtuoso
        key={session.id}
        className="h-full"
        data={timelineItems}
        computeItemKey={(_, item) => item.id}
        followOutput={isFollowingOutput ? "smooth" : false}
        atBottomStateChange={setIsFollowingOutput}
        initialTopMostItemIndex={timelineItems.length - 1}
        overscan={400}
        itemContent={(_, item) => (
          <div className="mx-auto w-full max-w-5xl py-1">
            <AgentTimelineRow
              item={item}
              session={session}
              copiedPlanId={copiedPlanId}
              savingPlanId={savingPlanId}
              queuedPlanId={queuedPlanId}
              onCopyPlan={handleCopyPlan}
              onSavePlan={handleSavePlan}
              onImplementProposedPlan={handleImplementPlan}
            />
          </div>
        )}
      />
    </div>
  );
}

export default memo(AgentSessionTimelineContainer);
