import type { AgentActivity, AgentMessage } from "../../../entities";

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
    };

function getTimelineRank(item: AgentTimelineItem): number {
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

export function buildAgentTimeline(
  messages: AgentMessage[],
  activities: AgentActivity[],
): AgentTimelineItem[] {
  const timeline: Array<AgentTimelineItem & { sourceIndex: number }> = [
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

  return timeline;
}

