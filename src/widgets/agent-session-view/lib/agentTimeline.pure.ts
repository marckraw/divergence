import type { AgentActivity, AgentActivityStatus, AgentMessage } from "../../../entities";

export type AgentTimelineItem =
  | {
      id: string;
      kind: "message";
      atMs: number;
      message: AgentMessage;
    }
  | {
      id: string;
      kind: "activity";
      atMs: number;
      activity: AgentActivity;
      summary: string;
    }
  | {
      id: string;
      kind: "activity_group";
      atMs: number;
      groupKey: string;
      status: AgentActivityStatus;
      summary: string;
      activities: AgentActivity[];
    };

type TimelineInputItem =
  | {
      id: string;
      kind: "message";
      atMs: number;
      message: AgentMessage;
      sourceIndex: number;
    }
  | {
      id: string;
      kind: "activity";
      atMs: number;
      activity: AgentActivity;
      sourceIndex: number;
    };

function getTimelineRank(item: TimelineInputItem): number {
  if (item.kind === "activity") {
    return 1;
  }

  switch (item.message.role) {
    case "user":
      return 0;
    case "assistant":
      return 2;
    case "system":
    default:
      return 1;
  }
}

function getActivitySummary(activity: AgentActivity): string {
  return activity.summary || activity.title;
}

function canGroupActivities(left: AgentActivity, right: AgentActivity): boolean {
  if (left.status === "running" || right.status === "running") {
    return false;
  }

  return Boolean(left.groupKey)
    && Boolean(right.groupKey)
    && left.groupKey === right.groupKey
    && left.status === right.status;
}

function buildGroupedActivitySummary(groupKey: string, activities: AgentActivity[]): string {
  const count = activities.length;
  if (count <= 1) {
    return getActivitySummary(activities[0]);
  }

  switch (groupKey) {
    case "read":
      return `Read ${count} files`;
    case "edit":
      return `Edited ${count} files`;
    case "todo":
      return `Updated todo list ${count} times`;
    case "command":
      return `Ran ${count} commands`;
    case "search":
      return `Ran ${count} searches`;
    case "thinking":
      return `Thinking in ${count} steps`;
    default: {
      const first = getActivitySummary(activities[0]);
      if (groupKey.startsWith("mcp:")) {
        return `${first} ${count} times`;
      }
      if (groupKey.startsWith("skill:")) {
        return `${first} ${count} times`;
      }
      return `${first} (${count} steps)`;
    }
  }
}

function appendActivityItem(output: AgentTimelineItem[], activity: AgentActivity): void {
  const summary = getActivitySummary(activity);
  const previous = output[output.length - 1];

  if (previous?.kind === "activity_group") {
    const lastActivity = previous.activities[previous.activities.length - 1];
    if (
      lastActivity
      && activity.groupKey
      && previous.groupKey === activity.groupKey
      && canGroupActivities(lastActivity, activity)
    ) {
      previous.activities.push(activity);
      previous.summary = buildGroupedActivitySummary(previous.groupKey, previous.activities);
      return;
    }
  }

  if (previous?.kind === "activity" && canGroupActivities(previous.activity, activity)) {
    const groupKey = activity.groupKey || previous.activity.groupKey || previous.activity.kind;
    output[output.length - 1] = {
      id: `${previous.activity.id}::${activity.id}`,
      kind: "activity_group",
      atMs: previous.atMs,
      groupKey,
      status: previous.activity.status,
      summary: buildGroupedActivitySummary(groupKey, [previous.activity, activity]),
      activities: [previous.activity, activity],
    };
    return;
  }

  output.push({
    id: activity.id,
    kind: "activity",
    atMs: activity.startedAtMs,
    activity,
    summary,
  });
}

export function buildAgentTimeline(
  messages: AgentMessage[],
  activities: AgentActivity[],
): AgentTimelineItem[] {
  const timeline: TimelineInputItem[] = [
    ...messages.map((message, sourceIndex) => ({
      id: message.id,
      kind: "message" as const,
      atMs: message.createdAtMs,
      message,
      sourceIndex,
    })),
    ...activities.map((activity, sourceIndex) => ({
      id: activity.id,
      kind: "activity" as const,
      atMs: activity.startedAtMs,
      activity,
      sourceIndex,
    })),
  ];

  timeline.sort((left, right) => {
    if (left.atMs !== right.atMs) {
      return left.atMs - right.atMs;
    }

    const rankDifference = getTimelineRank(left) - getTimelineRank(right);
    if (rankDifference !== 0) {
      return rankDifference;
    }

    return left.sourceIndex - right.sourceIndex;
  });

  const grouped: AgentTimelineItem[] = [];
  for (const item of timeline) {
    if (item.kind === "message") {
      grouped.push({
        id: item.id,
        kind: "message",
        atMs: item.atMs,
        message: item.message,
      });
      continue;
    }

    appendActivityItem(grouped, item.activity);
  }

  return grouped;
}
