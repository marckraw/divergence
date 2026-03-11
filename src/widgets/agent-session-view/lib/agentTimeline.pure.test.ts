import { describe, expect, it } from "vitest";
import { buildAgentTimeline } from "./agentTimeline.pure";

describe("buildAgentTimeline", () => {
  it("orders user messages before activities and assistant messages at the same timestamp", () => {
    const timeline = buildAgentTimeline(
      [
        {
          id: "user-1",
          role: "user",
          content: "Investigate this repo",
          status: "done",
          createdAtMs: 100,
        },
        {
          id: "assistant-1",
          role: "assistant",
          content: "Here is what I found",
          status: "done",
          createdAtMs: 100,
        },
      ],
      [
        {
          id: "activity-1",
          kind: "tool",
          title: "Read files",
          status: "completed",
          details: "README.md",
          startedAtMs: 100,
          completedAtMs: 101,
        },
      ],
    );

    expect(timeline.map((item) => item.id)).toEqual([
      "user-1",
      "activity-1",
      "assistant-1",
    ]);
  });

  it("preserves source order inside each kind when timestamps match", () => {
    const timeline = buildAgentTimeline(
      [
        {
          id: "user-1",
          role: "user",
          content: "one",
          status: "done",
          createdAtMs: 200,
        },
        {
          id: "user-2",
          role: "user",
          content: "two",
          status: "done",
          createdAtMs: 200,
        },
      ],
      [
        {
          id: "activity-1",
          kind: "tool",
          title: "Search",
          status: "completed",
          startedAtMs: 201,
        },
        {
          id: "activity-2",
          kind: "tool",
          title: "Read",
          status: "completed",
          startedAtMs: 201,
        },
      ],
    );

    expect(timeline.map((item) => item.id)).toEqual([
      "user-1",
      "user-2",
      "activity-1",
      "activity-2",
    ]);
  });

  it("groups adjacent compatible activities into grouped bursts", () => {
    const timeline = buildAgentTimeline(
      [],
      [
        {
          id: "activity-1",
          kind: "tool",
          title: "Read",
          summary: "Read CLAUDE.md",
          groupKey: "read",
          status: "completed",
          startedAtMs: 100,
        },
        {
          id: "activity-2",
          kind: "tool",
          title: "Read",
          summary: "Read AGENTS.md",
          groupKey: "read",
          status: "completed",
          startedAtMs: 101,
        },
      ],
    );

    expect(timeline).toHaveLength(1);
    expect(timeline[0]).toMatchObject({
      kind: "activity_group",
      summary: "Read 2 files",
    });
  });

  it("does not group activities across messages", () => {
    const timeline = buildAgentTimeline(
      [
        {
          id: "assistant-1",
          role: "assistant",
          content: "Done",
          status: "done",
          createdAtMs: 101,
        },
      ],
      [
        {
          id: "activity-1",
          kind: "tool",
          title: "Edit",
          summary: "Edited CLAUDE.md",
          groupKey: "edit",
          status: "completed",
          startedAtMs: 100,
        },
        {
          id: "activity-2",
          kind: "tool",
          title: "Edit",
          summary: "Edited README.md",
          groupKey: "edit",
          status: "completed",
          startedAtMs: 102,
        },
      ],
    );

    expect(timeline.map((item) => item.kind)).toEqual([
      "activity",
      "message",
      "activity",
    ]);
  });

  it("keeps running activities ungrouped", () => {
    const timeline = buildAgentTimeline(
      [],
      [
        {
          id: "activity-1",
          kind: "tool",
          title: "Read",
          summary: "Read CLAUDE.md",
          groupKey: "read",
          status: "running",
          startedAtMs: 100,
        },
        {
          id: "activity-2",
          kind: "tool",
          title: "Read",
          summary: "Read AGENTS.md",
          groupKey: "read",
          status: "completed",
          startedAtMs: 101,
        },
      ],
    );

    expect(timeline.map((item) => item.kind)).toEqual(["activity", "activity"]);
  });
});
