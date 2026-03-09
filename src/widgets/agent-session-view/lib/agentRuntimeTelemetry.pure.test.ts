import { describe, expect, it } from "vitest";
import {
  buildAgentRuntimeTelemetrySummary,
  formatRuntimeDuration,
  formatRuntimeEventOffset,
  getLatestRuntimeEvent,
} from "./agentRuntimeTelemetry.pure";

describe("formatRuntimeDuration", () => {
  it("formats seconds", () => {
    expect(formatRuntimeDuration(9_400)).toBe("9s");
  });

  it("formats minutes and seconds", () => {
    expect(formatRuntimeDuration(65_000)).toBe("1m 5s");
  });

  it("formats hours and minutes", () => {
    expect(formatRuntimeDuration(3_780_000)).toBe("1h 3m");
  });
});

describe("formatRuntimeEventOffset", () => {
  it("formats offsets from the current turn start", () => {
    expect(formatRuntimeEventOffset(15_000, 1_000)).toBe("+14s");
  });

  it("falls back safely when no turn start exists", () => {
    expect(formatRuntimeEventOffset(15_000, null)).toBe("+0s");
  });
});

describe("getLatestRuntimeEvent", () => {
  it("returns the newest runtime event", () => {
    expect(getLatestRuntimeEvent([
      { id: "event-1", atMs: 1_000, phase: "Queued", message: "Queued", details: undefined },
      { id: "event-2", atMs: 2_000, phase: "Running", message: "Running", details: undefined },
    ])?.id).toBe("event-2");
  });
});

describe("buildAgentRuntimeTelemetrySummary", () => {
  it("builds a slow warning when a running turn is quiet", () => {
    expect(buildAgentRuntimeTelemetrySummary({
      currentTurnStartedAtMs: 1_000,
      lastRuntimeEventAtMs: 4_000,
      runtimeEvents: [
        { id: "event-1", atMs: 4_000, phase: "Waiting for model", message: "Waiting", details: undefined },
      ],
      runtimePhase: "Waiting for model",
      runtimeStatus: "running",
      model: "gpt-5.4",
    }, 15_500)).toEqual({
      phaseLabel: "Waiting for model",
      elapsedLabel: "14s",
      lastEventLabel: "11s",
      latestEventMessage: "Waiting",
      slowWarning: "Still waiting on gpt-5.4.",
    });
  });

  it("keeps the warning clear when events are fresh", () => {
    expect(buildAgentRuntimeTelemetrySummary({
      currentTurnStartedAtMs: 5_000,
      lastRuntimeEventAtMs: 12_000,
      runtimeEvents: [],
      runtimePhase: null,
      runtimeStatus: "idle",
      model: "sonnet",
    }, 13_000).slowWarning).toBeNull();
  });
});
