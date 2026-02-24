import { describe, expect, it } from "vitest";
import { formatRunStatus } from "./automationFormatting.pure";

describe("formatRunStatus", () => {
  it("returns 'No runs yet' for undefined", () => {
    expect(formatRunStatus(undefined)).toBe("No runs yet");
  });

  it("returns 'No runs yet' for empty string", () => {
    expect(formatRunStatus("")).toBe("No runs yet");
  });

  it("maps known statuses", () => {
    expect(formatRunStatus("success")).toBe("Success");
    expect(formatRunStatus("error")).toBe("Failed");
    expect(formatRunStatus("running")).toBe("Running");
    expect(formatRunStatus("queued")).toBe("Queued");
    expect(formatRunStatus("skipped")).toBe("Skipped");
  });

  it("returns unknown status as-is", () => {
    expect(formatRunStatus("custom_status")).toBe("custom_status");
  });
});
