import { describe, expect, it } from "vitest";
import { renderTemplateCommand } from "./templateRendering.pure";

describe("renderTemplateCommand", () => {
  it("replaces single token", () => {
    expect(
      renderTemplateCommand("claude --dir {workspacePath}", {
        workspacePath: "/home/user/project",
      }),
    ).toBe("claude --dir /home/user/project");
  });

  it("replaces multiple tokens", () => {
    expect(
      renderTemplateCommand("cat {briefPath} | claude --cwd {workspacePath}", {
        workspacePath: "/home/user/project",
        briefPath: "/tmp/brief.md",
      }),
    ).toBe("cat /tmp/brief.md | claude --cwd /home/user/project");
  });

  it("replaces repeated tokens", () => {
    expect(
      renderTemplateCommand("{path} and {path}", { path: "/a" }),
    ).toBe("/a and /a");
  });

  it("returns template unchanged when no tokens match", () => {
    expect(
      renderTemplateCommand("echo hello", { workspacePath: "/x" }),
    ).toBe("echo hello");
  });

  it("handles empty tokens object", () => {
    expect(renderTemplateCommand("echo {hello}", {})).toBe("echo {hello}");
  });
});
