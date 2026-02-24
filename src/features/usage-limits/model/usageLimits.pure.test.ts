import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  formatUtilization,
  formatResetTime,
  formatTimeSince,
  getUsageLevel,
  getUsageLevelColor,
  getUsageLevelBarColor,
  getSummaryUsageLevel,
} from "./usageLimits.pure";

const FIXED_NOW = new Date("2026-02-24T12:00:00.000Z");

describe("usage limits pure utils", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("formatUtilization", () => {
    it("formats decimal as percentage", () => {
      expect(formatUtilization(0)).toBe("0%");
      expect(formatUtilization(0.5)).toBe("50%");
      expect(formatUtilization(0.72)).toBe("72%");
      expect(formatUtilization(1)).toBe("100%");
    });

    it("rounds to nearest integer", () => {
      expect(formatUtilization(0.333)).toBe("33%");
      expect(formatUtilization(0.667)).toBe("67%");
    });
  });

  describe("formatResetTime", () => {
    it("returns empty string for null", () => {
      expect(formatResetTime(null)).toBe("");
    });

    it("returns 'now' for past dates", () => {
      const past = new Date(Date.now() - 60_000).toISOString();
      expect(formatResetTime(past)).toBe("now");
    });

    it("formats minutes only", () => {
      const future = new Date(Date.now() + 45 * 60_000).toISOString();
      expect(formatResetTime(future)).toBe("45m");
    });

    it("formats hours and minutes", () => {
      const future = new Date(Date.now() + (2 * 60 + 14) * 60_000).toISOString();
      expect(formatResetTime(future)).toBe("2h 14m");
    });

    it("formats days and hours", () => {
      const future = new Date(Date.now() + (5 * 24 + 3) * 60 * 60_000).toISOString();
      expect(formatResetTime(future)).toBe("5d 3h");
    });

    it("formats exact hours without minutes", () => {
      const future = new Date(Date.now() + 3 * 60 * 60_000).toISOString();
      expect(formatResetTime(future)).toBe("3h");
    });

    it("formats exact days without hours", () => {
      const future = new Date(Date.now() + 2 * 24 * 60 * 60_000).toISOString();
      expect(formatResetTime(future)).toBe("2d");
    });
  });

  describe("getUsageLevel", () => {
    it("returns normal for < 50%", () => {
      expect(getUsageLevel(0)).toBe("normal");
      expect(getUsageLevel(0.49)).toBe("normal");
    });

    it("returns warning for 50-79%", () => {
      expect(getUsageLevel(0.5)).toBe("warning");
      expect(getUsageLevel(0.79)).toBe("warning");
    });

    it("returns critical for >= 80%", () => {
      expect(getUsageLevel(0.8)).toBe("critical");
      expect(getUsageLevel(1.0)).toBe("critical");
    });
  });

  describe("getUsageLevelColor", () => {
    it("maps levels to background colors", () => {
      expect(getUsageLevelColor("normal")).toBe("bg-green");
      expect(getUsageLevelColor("warning")).toBe("bg-yellow");
      expect(getUsageLevelColor("critical")).toBe("bg-red");
    });
  });

  describe("getUsageLevelBarColor", () => {
    it("maps levels to bar colors", () => {
      expect(getUsageLevelBarColor("normal")).toBe("bg-accent");
      expect(getUsageLevelBarColor("warning")).toBe("bg-yellow");
      expect(getUsageLevelBarColor("critical")).toBe("bg-red");
    });
  });

  describe("getSummaryUsageLevel", () => {
    it("returns normal when no data", () => {
      expect(getSummaryUsageLevel(null, null)).toBe("normal");
    });

    it("returns level based on highest utilization", () => {
      const claude = {
        available: true,
        error: null,
        windows: [
          { utilization: 0.3, resetsAt: null, label: "Session" },
          { utilization: 0.72, resetsAt: null, label: "Weekly" },
        ],
      };
      expect(getSummaryUsageLevel(claude, null)).toBe("warning");
    });

    it("uses critical when any window is critical", () => {
      const claude = {
        available: true,
        error: null,
        windows: [{ utilization: 0.9, resetsAt: null, label: "Session" }],
      };
      const codex = {
        available: true,
        error: null,
        planType: "Pro",
        windows: [{ utilization: 0.3, resetsAt: null, label: "Primary" }],
      };
      expect(getSummaryUsageLevel(claude, codex)).toBe("critical");
    });
  });

  describe("formatTimeSince", () => {
    it("returns 'never' for null", () => {
      expect(formatTimeSince(null)).toBe("never");
    });

    it("returns 'just now' for recent timestamps", () => {
      expect(formatTimeSince(Date.now() - 2000)).toBe("just now");
    });

    it("returns seconds for < 60s", () => {
      expect(formatTimeSince(Date.now() - 30_000)).toBe("30s ago");
    });

    it("returns minutes for >= 60s", () => {
      expect(formatTimeSince(Date.now() - 150_000)).toBe("2m ago");
    });
  });
});
