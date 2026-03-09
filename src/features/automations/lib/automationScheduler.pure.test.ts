import { describe, expect, it } from "vitest";
import type { Automation } from "../../../entities/automation";
import { getDefaultAgentProvider } from "../../../shared";
import {
  buildAutomationBranchName,
  buildAutomationPromptMarkdown,
  computeAutomationNextRunAtMs,
  computeNextScheduledRunAtMs,
  findDueAutomations,
  isAutomationDue,
  normalizeAutomationIntervalHours,
  sanitizeAutomationNameForBranch,
} from "./automationScheduler.pure";

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
        { enabled: true, intervalHours: 6, nextRunAtMs: twopm, runMode: "schedule" },
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
        { enabled: true, intervalHours: 6, nextRunAtMs: twopm, runMode: "schedule" },
        elevenpm,
      );
      const twoam = Date.UTC(2026, 0, 2, 2, 0, 0);
      expect(result).toBe(twoam);
    });

    it("returns null for disabled automation", () => {
      const result = computeNextScheduledRunAtMs(
        { enabled: false, intervalHours: 6, nextRunAtMs: 1000, runMode: "schedule" },
        2000,
      );
      expect(result).toBeNull();
    });

    it("returns null for event-run automations", () => {
      const result = computeNextScheduledRunAtMs(
        { enabled: true, intervalHours: 6, nextRunAtMs: 1000, runMode: "event" },
        2000,
      );
      expect(result).toBeNull();
    });

    it("uses nowMs as anchor when nextRunAtMs is null (manual run)", () => {
      const nowMs = Date.UTC(2026, 0, 1, 15, 0, 0);
      const result = computeNextScheduledRunAtMs(
        { enabled: true, intervalHours: 4, nextRunAtMs: null, runMode: "schedule" },
        nowMs,
      );
      expect(result).toBe(nowMs + 4 * HOUR_MS);
    });

    it("boundary: next equals nowMs must still advance to future", () => {
      // anchor + interval lands exactly on nowMs → must not return nowMs
      const anchor = Date.UTC(2026, 0, 1, 10, 0, 0);
      const intervalHours = 2;
      const nowMs = anchor + intervalHours * HOUR_MS; // next === nowMs
      const result = computeNextScheduledRunAtMs(
        { enabled: true, intervalHours, nextRunAtMs: anchor, runMode: "schedule" },
        nowMs,
      );
      expect(result).toBe(nowMs + intervalHours * HOUR_MS);
      expect(result).toBeGreaterThan(nowMs);
    });

    it("boundary: missed exactly one full interval must land in future", () => {
      // anchor + interval is in the past by exactly one more interval
      const anchor = Date.UTC(2026, 0, 1, 10, 0, 0);
      const intervalHours = 3;
      const next = anchor + intervalHours * HOUR_MS; // 1pm
      const nowMs = next + intervalHours * HOUR_MS;  // 4pm (missed by exactly 1 interval)
      const result = computeNextScheduledRunAtMs(
        { enabled: true, intervalHours, nextRunAtMs: anchor, runMode: "schedule" },
        nowMs,
      );
      expect(result).toBe(nowMs + intervalHours * HOUR_MS); // 7pm
      expect(result).toBeGreaterThan(nowMs);
    });
  });

  describe("findDueAutomations", () => {
    function makeAutomation(overrides: Partial<Automation>): Automation {
      const merged: Automation = {
        id: 1,
        name: "test",
        projectId: 1,
        agent: getDefaultAgentProvider(),
        prompt: "test",
        intervalHours: 6,
        runMode: "schedule",
        sourceProjectId: null,
        targetProjectId: null,
        triggerType: null,
        triggerConfigJson: null,
        enabled: true,
        keepSessionAlive: false,
        lastRunAtMs: null,
        nextRunAtMs: 1000,
        createdAtMs: 500,
        updatedAtMs: 500,
        workspaceId: null,
        ...overrides,
      };
      return {
        ...merged,
        sourceProjectId: merged.sourceProjectId ?? null,
        targetProjectId: merged.targetProjectId ?? null,
        triggerType: merged.triggerType ?? null,
        triggerConfigJson: merged.triggerConfigJson ?? null,
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

    it("excludes event-mode automations from scheduler", () => {
      const nowMs = 2000;
      const automations = [
        makeAutomation({ id: 1, nextRunAtMs: 1000, enabled: true, runMode: "event" }),
      ];
      const result = findDueAutomations(automations, new Set(), nowMs);
      expect(result).toEqual([]);
    });
  });
});
