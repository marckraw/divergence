import { describe, expect, it } from "vitest";
import { generateWorkspaceSlug, buildWorkspaceFolderPath } from "./workspace.pure";

describe("generateWorkspaceSlug", () => {
  it("lowercases and replaces spaces with hyphens", () => {
    expect(generateWorkspaceSlug("My Workspace")).toBe("my-workspace");
  });

  it("strips special characters", () => {
    expect(generateWorkspaceSlug("Project!! @#$% Name")).toBe("project-name");
  });

  it("collapses consecutive hyphens", () => {
    expect(generateWorkspaceSlug("a---b")).toBe("a-b");
  });

  it("trims leading and trailing hyphens", () => {
    expect(generateWorkspaceSlug("--leading-trailing--")).toBe("leading-trailing");
  });

  it("handles empty string", () => {
    expect(generateWorkspaceSlug("")).toBe("");
  });

  it("preserves digits", () => {
    expect(generateWorkspaceSlug("v2 Project 3")).toBe("v2-project-3");
  });

  it("handles already clean slugs", () => {
    expect(generateWorkspaceSlug("clean-slug-123")).toBe("clean-slug-123");
  });
});

describe("buildWorkspaceFolderPath", () => {
  it("joins base path and slug", () => {
    expect(buildWorkspaceFolderPath("/home/user/.divergence/workspaces", "my-workspace"))
      .toBe("/home/user/.divergence/workspaces/my-workspace");
  });

  it("trims trailing slashes from base path", () => {
    expect(buildWorkspaceFolderPath("/base/path/", "slug"))
      .toBe("/base/path/slug");
  });

  it("trims multiple trailing slashes", () => {
    expect(buildWorkspaceFolderPath("/base///", "slug"))
      .toBe("/base/slug");
  });
});
