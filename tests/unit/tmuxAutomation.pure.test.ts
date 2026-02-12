import { describe, expect, it } from "vitest";
import {
  buildAutomationTmuxSessionName,
  buildAutomationLogPath,
  buildAutomationResultPath,
  buildWrapperCommand,
  parseAutomationResult,
  isAutomationSessionName,
} from "../../src/features/automations/lib/tmuxAutomation.pure";

describe("buildAutomationTmuxSessionName", () => {
  it("builds session name with automation and run IDs", () => {
    expect(buildAutomationTmuxSessionName(7, 99)).toBe("divergence-auto-7-99");
  });

  it("handles large IDs", () => {
    expect(buildAutomationTmuxSessionName(123, 456789)).toBe("divergence-auto-123-456789");
  });
});

describe("isAutomationSessionName", () => {
  it("returns true for automation session names", () => {
    expect(isAutomationSessionName("divergence-auto-7-99")).toBe(true);
  });

  it("returns false for other divergence sessions", () => {
    expect(isAutomationSessionName("divergence-project-myapp-1")).toBe(false);
  });

  it("returns false for non-divergence sessions", () => {
    expect(isAutomationSessionName("my-session")).toBe(false);
  });
});

describe("buildAutomationLogPath", () => {
  it("builds log path under .divergence/automation-runs", () => {
    expect(buildAutomationLogPath("/projects/myapp", 42)).toBe(
      "/projects/myapp/.divergence/automation-runs/42.log"
    );
  });
});

describe("buildAutomationResultPath", () => {
  it("builds result path under .divergence/automation-runs", () => {
    expect(buildAutomationResultPath("/projects/myapp", 42)).toBe(
      "/projects/myapp/.divergence/automation-runs/42.result.json"
    );
  });
});

describe("buildWrapperCommand", () => {
  it("produces a shell command that creates dir, runs agent, and writes result", () => {
    const cmd = buildWrapperCommand({
      agentCommand: "claude --print 'fix bug'",
      logPath: "/tmp/42.log",
      resultPath: "/tmp/42.result.json",
    });

    expect(cmd).toContain("mkdir -p");
    expect(cmd).toContain("claude --print 'fix bug'");
    expect(cmd).toContain("tee");
    expect(cmd).toContain("PIPESTATUS");
    expect(cmd).toContain("printf");
    expect(cmd).toContain('exit "$_DIV_EXIT"');
  });

  it("shell-escapes paths with single quotes", () => {
    const cmd = buildWrapperCommand({
      agentCommand: "echo hello",
      logPath: "/tmp/my project/42.log",
      resultPath: "/tmp/my project/42.result.json",
    });

    expect(cmd).toContain("'/tmp/my project/42.log'");
  });
});

describe("parseAutomationResult", () => {
  it("parses valid result JSON", () => {
    const json = JSON.stringify({
      status: "completed",
      exitCode: 0,
      startedAt: "2025-01-01T00:00:00Z",
      finishedAt: "2025-01-01T00:05:00Z",
    });
    const result = parseAutomationResult(json);
    expect(result).toEqual({
      status: "completed",
      exitCode: 0,
      startedAt: "2025-01-01T00:00:00Z",
      finishedAt: "2025-01-01T00:05:00Z",
    });
  });

  it("parses result with non-zero exit code", () => {
    const json = JSON.stringify({
      status: "completed",
      exitCode: 1,
      startedAt: "2025-01-01T00:00:00Z",
      finishedAt: "2025-01-01T00:05:00Z",
    });
    const result = parseAutomationResult(json);
    expect(result?.exitCode).toBe(1);
  });

  it("returns null for invalid JSON", () => {
    expect(parseAutomationResult("not json")).toBeNull();
  });

  it("returns null for missing fields", () => {
    expect(parseAutomationResult(JSON.stringify({ status: "completed" }))).toBeNull();
  });

  it("returns null for wrong status", () => {
    const json = JSON.stringify({
      status: "running",
      exitCode: 0,
      startedAt: "2025-01-01T00:00:00Z",
      finishedAt: "2025-01-01T00:05:00Z",
    });
    expect(parseAutomationResult(json)).toBeNull();
  });
});
