import { describe, expect, it } from "vitest";
import { formatTimestamp, formatRelativeAge } from "./dateTime.pure";

describe("formatTimestamp", () => {
  it("returns fallback for null/undefined/zero", () => {
    expect(formatTimestamp(null, "Never")).toBe("Never");
    expect(formatTimestamp(undefined, "—")).toBe("—");
    expect(formatTimestamp(0, "Not scheduled")).toBe("Not scheduled");
  });

  it("formats a valid millisecond timestamp", () => {
    const ms = new Date("2024-06-15T12:00:00Z").getTime();
    const result = formatTimestamp(ms, "fallback");
    expect(result).not.toBe("fallback");
    expect(result.length).toBeGreaterThan(0);
  });
});

describe("formatRelativeAge", () => {
  const NOW = 1_700_000_000_000;

  it("returns 'unknown' for null/undefined", () => {
    expect(formatRelativeAge(null, NOW)).toBe("unknown");
    expect(formatRelativeAge(undefined, NOW)).toBe("unknown");
  });

  it("returns 'just now' for less than 2s ago", () => {
    expect(formatRelativeAge(NOW - 1_000, NOW)).toBe("just now");
    expect(formatRelativeAge(NOW, NOW)).toBe("just now");
  });

  it("returns seconds for < 60s", () => {
    expect(formatRelativeAge(NOW - 30_000, NOW)).toBe("30s ago");
  });

  it("returns minutes and seconds for < 60m", () => {
    expect(formatRelativeAge(NOW - 125_000, NOW)).toBe("2m 5s ago");
  });

  it("returns hours and minutes for < 24h", () => {
    expect(formatRelativeAge(NOW - 7_320_000, NOW)).toBe("2h 2m ago");
  });

  it("returns days and hours for >= 24h", () => {
    expect(formatRelativeAge(NOW - 90_000_000, NOW)).toBe("1d 1h ago");
  });

  it("omits remainder when it is zero", () => {
    expect(formatRelativeAge(NOW - 3_600_000, NOW)).toBe("1h ago");
    expect(formatRelativeAge(NOW - 86_400_000, NOW)).toBe("1d ago");
  });
});
