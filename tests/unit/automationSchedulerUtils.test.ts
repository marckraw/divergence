import { describe, expect, it } from "vitest";
import {
  buildAutomationBranchName,
  buildAutomationPromptMarkdown,
  computeAutomationNextRunAtMs,
  isAutomationDue,
  normalizeAutomationIntervalHours,
  sanitizeAutomationNameForBranch,
} from "../../src/app/lib/automationScheduler.pure";

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
});
