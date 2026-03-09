import { describe, expect, it } from "vitest";
import type { DebugEvent } from "../../../shared";
import {
  countEventsByLevel,
  eventMatchesSearchQuery,
  filterDebugEvents,
  isFailureOrStuckEvent,
} from "./debugConsole.pure";

function makeEvent(partial: Partial<DebugEvent>): DebugEvent {
  return {
    id: partial.id ?? "event-1",
    atMs: partial.atMs ?? 1,
    level: partial.level ?? "info",
    category: partial.category ?? "terminal",
    message: partial.message ?? "message",
    details: partial.details,
    metadata: partial.metadata,
  };
}

describe("debugConsole.pure", () => {
  it("matches search query across message/details/metadata", () => {
    const event = makeEvent({
      message: "Terminal startup stalled",
      details: "tmux path missing",
      metadata: { sessionId: "abc-123" },
    });

    expect(eventMatchesSearchQuery(event, "stalled")).toBe(true);
    expect(eventMatchesSearchQuery(event, "tmux path")).toBe(true);
    expect(eventMatchesSearchQuery(event, "abc-123")).toBe(true);
    expect(eventMatchesSearchQuery(event, "not-found")).toBe(false);
  });

  it("detects failure or stuck events", () => {
    expect(isFailureOrStuckEvent(makeEvent({ level: "error", message: "something" }))).toBe(true);
    expect(isFailureOrStuckEvent(makeEvent({ level: "warn", message: "Terminal startup stalled" }))).toBe(true);
    expect(isFailureOrStuckEvent(makeEvent({ level: "info", message: "PTY spawned" }))).toBe(false);
  });

  it("filters by level/category/search/failure toggle", () => {
    const events = [
      makeEvent({
        id: "1",
        level: "info",
        category: "terminal",
        message: "PTY spawned",
      }),
      makeEvent({
        id: "2",
        level: "warn",
        category: "tmux",
        message: "Terminal startup stalled",
      }),
      makeEvent({
        id: "3",
        level: "error",
        category: "app",
        message: "Unhandled promise rejection",
      }),
      makeEvent({
        id: "4",
        level: "info",
        category: "agent_runtime",
        message: "Manual agent runtime snapshot captured",
      }),
    ];

    expect(
      filterDebugEvents(events, {
        level: "all",
        category: "all",
        searchQuery: "",
        onlyFailureOrStuck: false,
      }).map((event) => event.id)
    ).toEqual(["1", "2", "3", "4"]);

    expect(
      filterDebugEvents(events, {
        level: "warn",
        category: "all",
        searchQuery: "",
        onlyFailureOrStuck: false,
      }).map((event) => event.id)
    ).toEqual(["2"]);

    expect(
      filterDebugEvents(events, {
        level: "all",
        category: "tmux",
        searchQuery: "stall",
        onlyFailureOrStuck: true,
      }).map((event) => event.id)
    ).toEqual(["2"]);

    expect(
      filterDebugEvents(events, {
        level: "all",
        category: "agent_runtime",
        searchQuery: "snapshot",
        onlyFailureOrStuck: false,
      }).map((event) => event.id)
    ).toEqual(["4"]);
  });

  it("counts events by level", () => {
    const counts = countEventsByLevel([
      makeEvent({ level: "info" }),
      makeEvent({ level: "info" }),
      makeEvent({ level: "warn" }),
      makeEvent({ level: "error" }),
    ]);
    expect(counts).toEqual({ info: 2, warn: 1, error: 1 });
  });
});
