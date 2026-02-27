import { describe, expect, it } from "vitest";
import { resolvePromptQueueScope } from "./promptQueueScope.pure";

describe("resolvePromptQueueScope", () => {
  it("maps project sessions to project scope", () => {
    expect(resolvePromptQueueScope({
      type: "project",
      projectId: 11,
      targetId: 11,
      workspaceOwnerId: undefined,
    })).toEqual({ scopeType: "project", scopeId: 11 });
  });

  it("maps divergence sessions to project scope", () => {
    expect(resolvePromptQueueScope({
      type: "divergence",
      projectId: 13,
      targetId: 99,
      workspaceOwnerId: undefined,
    })).toEqual({ scopeType: "project", scopeId: 13 });
  });

  it("maps workspace sessions to workspace scope", () => {
    expect(resolvePromptQueueScope({
      type: "workspace",
      projectId: 0,
      targetId: 7,
      workspaceOwnerId: 7,
    })).toEqual({ scopeType: "workspace", scopeId: 7 });
  });

  it("maps workspace divergence sessions to workspace owner scope", () => {
    expect(resolvePromptQueueScope({
      type: "workspace_divergence",
      projectId: 0,
      targetId: 24,
      workspaceOwnerId: 5,
    })).toEqual({ scopeType: "workspace", scopeId: 5 });
  });

  it("falls back to target id when workspace owner id is missing", () => {
    expect(resolvePromptQueueScope({
      type: "workspace_divergence",
      projectId: 0,
      targetId: 24,
      workspaceOwnerId: undefined,
    })).toEqual({ scopeType: "workspace", scopeId: 24 });
  });

  it("returns null for invalid project scope", () => {
    expect(resolvePromptQueueScope({
      type: "project",
      projectId: 0,
      targetId: 1,
      workspaceOwnerId: undefined,
    })).toBeNull();
  });

  it("returns null for missing session", () => {
    expect(resolvePromptQueueScope(null)).toBeNull();
  });
});
