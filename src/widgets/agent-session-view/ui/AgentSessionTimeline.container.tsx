import { memo, useState } from "react";
import { Virtuoso } from "react-virtuoso";
import { Button, EmptyState } from "../../../shared";
import type { AgentActivity, AgentMessage } from "../../../entities";
import type { AgentTimelineItem } from "../lib/agentTimeline.pure";
import type { AgentSessionTimelineProps } from "./AgentSessionView.types";
import AgentTimelineActivityGroupRowPresentational from "./AgentTimelineActivityGroupRow.presentational";
import AgentTimelineActivityRowPresentational from "./AgentTimelineActivityRow.presentational";
import AgentTimelineMessageRowPresentational from "./AgentTimelineMessageRow.presentational";

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

const AgentTimelineMessageRow = memo(function AgentTimelineMessageRow({
  message,
}: {
  message: AgentMessage;
}) {
  return <AgentTimelineMessageRowPresentational message={message} />;
}, (previous, next) => areMessagesEqual(previous.message, next.message));

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
      <div className="flex min-w-0 flex-wrap items-center gap-1.5 sm:gap-2">
        <span className="shrink-0 rounded-full border border-surface/80 px-1.5 py-0.5 text-[8px] uppercase tracking-[0.14em] text-subtext/80">
          {formatActivityKind(activity.kind)}
        </span>
        <p className="min-w-0 flex-1 basis-16 truncate text-[12px] leading-4 text-subtext">
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
    <AgentTimelineActivityRowPresentational
      toneDotClassName={
        activity.status === "error"
          ? "bg-red"
          : activity.status === "running"
            ? "bg-yellow"
            : "bg-accent"
      }
      kindLabel={formatActivityKind(activity.kind)}
      summary={summary}
      status={activity.status}
      statusClassName={getActivityToneClass(activity.status)}
      detailsToggle={activity.details ? (
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
      ) : null}
      details={activity.details && isDetailsOpen ? (
        <pre className="mt-1.5 overflow-x-auto rounded-lg border border-surface/80 bg-main/80 p-2 whitespace-pre-wrap break-words font-mono text-[11px] leading-5 text-subtext">
          {activity.details}
        </pre>
      ) : null}
    />
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
    <AgentTimelineActivityGroupRowPresentational
      toneDotClassName={
        status === "error" ? "bg-red" : status === "running" ? "bg-yellow" : "bg-accent"
      }
      summary={summary}
      stepCount={activities.length}
      status={status}
      statusClassName={getActivityToneClass(status)}
      toggleButton={
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
      }
      details={isExpanded ? (
        <div className="mt-2 space-y-1.5">
          {activities.map((activity) => (
            <AgentTimelineActivityStep key={activity.id} activity={activity} />
          ))}
        </div>
      ) : null}
    />
  );
}

const AgentTimelineRow = memo(function AgentTimelineRow({
  item,
}: {
  item: AgentTimelineItem;
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

  return <AgentTimelineMessageRow message={item.message} />;
});

function AgentSessionTimelineContainer({
  session,
  timelineItems,
}: AgentSessionTimelineProps) {
  const [isFollowingOutput, setIsFollowingOutput] = useState(true);

  if (timelineItems.length === 0) {
    return (
      <div className="flex-1 min-h-0 overflow-y-auto px-3 py-5 sm:px-5">
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
    <div className="flex-1 min-h-0 px-3 py-5 sm:px-5">
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
            <AgentTimelineRow item={item} />
          </div>
        )}
      />
    </div>
  );
}

export default memo(AgentSessionTimelineContainer);
