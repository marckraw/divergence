import { describe, expect, it } from "vitest";
import type { Automation } from "../../src/entities/automation";
import {
  buildAutomationBranchName,
  buildAutomationPromptMarkdown,
  computeAutomationNextRunAtMs,
  computeNextScheduledRunAtMs,
  findDueAutomations,
  isAutomationDue,
  normalizeAutomationIntervalHours,
  sanitizeAutomationNameForBranch,
} from "../../src/features/automations/lib/automationScheduler.pure";

describe("automation scheduler utils", () => {
  it("normalizes interval hours", () => {
    expect(normalizeAutomationIntervalHours(5)).toBe(5);
    expect(normalizeAutomationIntervalHours(0)).toBe(1);
    expect(normalizeAutomationIntervalHours(Number.NaN)).toBe(1);
  });

  it("computes next run time", () => {
    const lastRunAtMs = Date.UTC(2026, 0, 1, 10, 0, 0);
    expect(computeAutomationNextRunAtMs(lastRunAtMs, 5)).toBe(lastRunAtMs + 5 * 60 * 60 * 1000);
  });

  it("checks due state", () => {
    const nowMs = Date.UTC(2026, 0, 1, 12, 0, 0);
    expect(isAutomationDue({ enabled: true, nextRunAtMs: nowMs - 1 }, nowMs)).toBe(true);
    expect(isAutomationDue({ enabled: false, nextRunAtMs: nowMs - 1 }, nowMs)).toBe(false);
    expect(isAutomationDue({ enabled: true, nextRunAtMs: null }, nowMs)).toBe(false);
  });

  it("builds branch name and prompt markdown", () => {
    const timestamp = Date.UTC(2026, 1, 8, 10, 30, 45);
    expect(sanitizeAutomationNameForBranch("Audit DRY")).toBe("audit-dry");
    expect(sanitizeAutomationNameForBranch("  !!!  ")).toBe("run");
    const branch = buildAutomationBranchName(17, "Audit DRY", timestamp);
    expect(branch).toMatch(/^automation\/17-audit-dry-\d{8}-\d{6}\d{3}$/);

    const markdown = buildAutomationPromptMarkdown({
      automationName: "Nightly audit",
      projectName: "divergence",
      triggerSource: "schedule",
      prompt: "Check regressions",
      generatedAtMs: timestamp,
    });
    expect(markdown).toContain("Nightly audit");
    expect(markdown).toContain("Project: divergence");
    expect(markdown).toContain("Check regressions");
  });

  describe("computeNextScheduledRunAtMs", () => {
    const HOUR_MS = 60 * 60 * 1000;

    it("normal case: anchor + interval", () => {
      // Scheduled at 2pm, 6h interval -> next is 8pm
      const twopm = Date.UTC(2026, 0, 1, 14, 0, 0);
      const result = computeNextScheduledRunAtMs(
        { enabled: true, intervalHours: 6, nextRunAtMs: twopm },
        twopm + 30 * 60 * 1000, // now is 2:30pm (run just finished)
      );
      expect(result).toBe(twopm + 6 * HOUR_MS); // 8pm
    });

    it("missed intervals: advances to next future slot", () => {
      // Scheduled at 2pm, 6h interval. App reopens at 11pm.
      // 2pm + 6h = 8pm (past). Skip to next: 8pm + 6h = 2am
      const twopm = Date.UTC(2026, 0, 1, 14, 0, 0);
      const elevenpm = Date.UTC(2026, 0, 1, 23, 0, 0);
      const result = computeNextScheduledRunAtMs(
        { enabled: true, intervalHours: 6, nextRunAtMs: twopm },
        elevenpm,
      );
      const twoam = Date.UTC(2026, 0, 2, 2, 0, 0);
      expect(result).toBe(twoam);
    });

    it("returns null for disabled automation", () => {
      const result = computeNextScheduledRunAtMs(
        { enabled: false, intervalHours: 6, nextRunAtMs: 1000 },
        2000,
      );
      expect(result).toBeNull();
    });

    it("uses nowMs as anchor when nextRunAtMs is null (manual run)", () => {
      const nowMs = Date.UTC(2026, 0, 1, 15, 0, 0);
      const result = computeNextScheduledRunAtMs(
        { enabled: true, intervalHours: 4, nextRunAtMs: null },
        nowMs,
      );
      expect(result).toBe(nowMs + 4 * HOUR_MS);
    });
  });

  describe("findDueAutomations", () => {
    function makeAutomation(overrides: Partial<Automation>): Automation {
      return {
        id: 1,
        name: "test",
        projectId: 1,
        agent: "claude",
        prompt: "test",
        intervalHours: 6,
        enabled: true,
        keepSessionAlive: false,
        lastRunAtMs: null,
        nextRunAtMs: 1000,
        createdAtMs: 500,
        updatedAtMs: 500,
        ...overrides,
      };
    }

    it("returns due automations that are not running", () => {
      const nowMs = 2000;
      const automations = [
        makeAutomation({ id: 1, nextRunAtMs: 1000, enabled: true }),
        makeAutomation({ id: 2, nextRunAtMs: 3000, enabled: true }),
        makeAutomation({ id: 3, nextRunAtMs: 500, enabled: true }),
      ];
      const running = new Set<number>();
      const result = findDueAutomations(automations, running, nowMs);
      expect(result.map(a => a.id)).toEqual([1, 3]);
    });

    it("excludes already-running automations", () => {
      const nowMs = 2000;
      const automations = [
        makeAutomation({ id: 1, nextRunAtMs: 1000, enabled: true }),
        makeAutomation({ id: 2, nextRunAtMs: 500, enabled: true }),
      ];
      const running = new Set([1]);
      const result = findDueAutomations(automations, running, nowMs);
      expect(result.map(a => a.id)).toEqual([2]);
    });

    it("excludes disabled automations", () => {
      const nowMs = 2000;
      const automations = [
        makeAutomation({ id: 1, nextRunAtMs: 1000, enabled: false }),
      ];
      const result = findDueAutomations(automations, new Set(), nowMs);
      expect(result).toEqual([]);
    });

    it("excludes automations with null nextRunAtMs", () => {
      const nowMs = 2000;
      const automations = [
        makeAutomation({ id: 1, nextRunAtMs: null, enabled: true }),
      ];
      const result = findDueAutomations(automations, new Set(), nowMs);
      expect(result).toEqual([]);
    });
  });
});
