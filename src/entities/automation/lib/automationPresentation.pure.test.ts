import { describe, expect, it } from "vitest";
import {
  formatAutomationRunStatus,
  formatAutomationTimestamp,
} from "./automationPresentation.pure";

describe("formatAutomationRunStatus", () => {
  it("uses default label for empty statuses", () => {
    expect(formatAutomationRunStatus(undefined)).toBe("No runs yet");
    expect(formatAutomationRunStatus("")).toBe("No runs yet");
  });

  it("maps known statuses to readable labels", () => {
    expect(formatAutomationRunStatus("success")).toBe("Success");
    expect(formatAutomationRunStatus("error")).toBe("Failed");
    expect(formatAutomationRunStatus("running")).toBe("Running");
    expect(formatAutomationRunStatus("queued")).toBe("Queued");
    expect(formatAutomationRunStatus("skipped")).toBe("Skipped");
  });

  it("keeps unknown statuses as-is", () => {
    expect(formatAutomationRunStatus("stalled")).toBe("stalled");
  });
});

describe("formatAutomationTimestamp", () => {
  it("returns fallback for missing values", () => {
    expect(formatAutomationTimestamp(null, "Never")).toBe("Never");
    expect(formatAutomationTimestamp(undefined, "Not scheduled")).toBe("Not scheduled");
    expect(formatAutomationTimestamp(0, "Never")).toBe("Never");
  });

  it("formats known timestamps", () => {
    const now = Date.UTC(2026, 1, 18, 12, 30, 0);
    const formatted = formatAutomationTimestamp(now, "Never");
    expect(formatted).not.toBe("Never");
    expect(formatted.length).toBeGreaterThan(0);
  });
});
