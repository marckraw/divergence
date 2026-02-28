import { describe, expect, it } from "vitest";
import {
  buildLinearIssuePrompt,
  truncateLinearIssueDescription,
} from "./linearTaskQueue.pure";

describe("truncateLinearIssueDescription", () => {
  it("returns null for empty input", () => {
    expect(truncateLinearIssueDescription(null)).toBeNull();
    expect(truncateLinearIssueDescription("   ")).toBeNull();
  });

  it("returns trimmed description when below limit", () => {
    expect(truncateLinearIssueDescription("  short text  ", 20)).toBe("short text");
  });

  it("truncates and appends suffix when above limit", () => {
    expect(truncateLinearIssueDescription("abcdefghij", 5)).toBe("abcde...");
  });
});

describe("buildLinearIssuePrompt", () => {
  it("includes title and identifier", () => {
    const prompt = buildLinearIssuePrompt({
      identifier: "ABC-123",
      title: "Fix flaky tests",
      description: null,
      stateName: null,
      url: null,
    });

    expect(prompt).toContain("ABC-123");
    expect(prompt).toContain("Fix flaky tests");
  });

  it("includes optional fields when available", () => {
    const prompt = buildLinearIssuePrompt({
      identifier: "ABC-123",
      title: "Fix flaky tests",
      description: "Investigate CI failures.",
      stateName: "In Progress",
      url: "https://linear.app/example/issue/ABC-123",
    });

    expect(prompt).toContain("Current state: In Progress");
    expect(prompt).toContain("Issue URL: https://linear.app/example/issue/ABC-123");
    expect(prompt).toContain("Issue description:\nInvestigate CI failures.");
  });
});
