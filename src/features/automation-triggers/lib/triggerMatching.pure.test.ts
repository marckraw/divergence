import { describe, expect, it } from "vitest";
import type { Automation } from "../../../entities/automation";
import {
  doesAutomationMatchGithubMergedEvent,
  parseGithubTriggerBaseBranches,
} from "./triggerMatching.pure";

function makeAutomation(overrides: Partial<Automation>): Automation {
  return {
    id: 1,
    name: "sync landing",
    projectId: 1,
    agent: "claude",
    prompt: "sync docs",
    intervalHours: 1,
    runMode: "event",
    sourceProjectId: 1,
    targetProjectId: 2,
    triggerType: "github_pr_merged",
    triggerConfigJson: JSON.stringify({ baseBranches: ["stable"] }),
    enabled: true,
    keepSessionAlive: false,
    lastRunAtMs: null,
    nextRunAtMs: null,
    createdAtMs: 1,
    updatedAtMs: 1,
    workspaceId: null,
    ...overrides,
  };
}

describe("parseGithubTriggerBaseBranches", () => {
  it("returns parsed branches", () => {
    expect(parseGithubTriggerBaseBranches(JSON.stringify({ baseBranches: ["stable", " staging "] })))
      .toEqual(["stable", "staging"]);
  });

  it("returns empty for invalid json", () => {
    expect(parseGithubTriggerBaseBranches("{bad")).toEqual([]);
  });
});

describe("doesAutomationMatchGithubMergedEvent", () => {
  it("matches valid event automation", () => {
    const automation = makeAutomation({});
    expect(doesAutomationMatchGithubMergedEvent({
      automation,
      sourceRepoKey: "foo/divergence",
      eventRepoKey: "foo/divergence",
      eventBaseRef: "stable",
    })).toBe(true);
  });

  it("rejects non-event automations", () => {
    const automation = makeAutomation({ runMode: "schedule" });
    expect(doesAutomationMatchGithubMergedEvent({
      automation,
      sourceRepoKey: "foo/divergence",
      eventRepoKey: "foo/divergence",
      eventBaseRef: "stable",
    })).toBe(false);
  });

  it("rejects non-matching base branch", () => {
    const automation = makeAutomation({});
    expect(doesAutomationMatchGithubMergedEvent({
      automation,
      sourceRepoKey: "foo/divergence",
      eventRepoKey: "foo/divergence",
      eventBaseRef: "main",
    })).toBe(false);
  });
});
