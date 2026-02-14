import { describe, expect, it } from "vitest";
import {
  buildAutomationTmuxSessionName,
  buildAutomationLogPath,
  buildAutomationResultPath,
  buildWrapperCommand,
  parseAutomationResult,
  isAutomationSessionName,
  classifyAutomationError,
  buildAutomationErrorMessage,
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

  it("does not include keepalive or auth retry logic", () => {
    const cmd = buildWrapperCommand({
      agentCommand: "claude --print 'fix bug'",
      logPath: "/tmp/42.log",
      resultPath: "/tmp/42.result.json",
    });

    expect(cmd).not.toContain("_DIV_KEEPALIVE_PID");
    expect(cmd).not.toContain("sleep 1800");
    expect(cmd).not.toContain("_DIV_ERROR_CATEGORY");
    expect(cmd).not.toContain("grep");

    // The agent command should appear exactly once (no retry)
    const matches = cmd.split("claude --print 'fix bug'");
    expect(matches.length).toBe(2); // 1 occurrence = 2 splits
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

  it("preserves errorCategory when present", () => {
    const json = JSON.stringify({
      status: "completed",
      exitCode: 1,
      startedAt: "2025-01-01T00:00:00Z",
      finishedAt: "2025-01-01T00:05:00Z",
      errorCategory: "auth",
    });
    const result = parseAutomationResult(json);
    expect(result?.errorCategory).toBe("auth");
  });

  it("preserves errorCategory general when present", () => {
    const json = JSON.stringify({
      status: "completed",
      exitCode: 1,
      startedAt: "2025-01-01T00:00:00Z",
      finishedAt: "2025-01-01T00:05:00Z",
      errorCategory: "general",
    });
    const result = parseAutomationResult(json);
    expect(result?.errorCategory).toBe("general");
  });

  it("omits errorCategory for backward-compatible JSON without the field", () => {
    const json = JSON.stringify({
      status: "completed",
      exitCode: 0,
      startedAt: "2025-01-01T00:00:00Z",
      finishedAt: "2025-01-01T00:05:00Z",
    });
    const result = parseAutomationResult(json);
    expect(result).not.toBeNull();
    expect(result?.errorCategory).toBeUndefined();
  });

  it("ignores invalid errorCategory values", () => {
    const json = JSON.stringify({
      status: "completed",
      exitCode: 1,
      startedAt: "2025-01-01T00:00:00Z",
      finishedAt: "2025-01-01T00:05:00Z",
      errorCategory: "unknown",
    });
    const result = parseAutomationResult(json);
    expect(result).not.toBeNull();
    expect(result?.errorCategory).toBeUndefined();
  });
});

describe("classifyAutomationError", () => {
  it("returns 'auth' when log contains OAuth token expired", () => {
    expect(classifyAutomationError(1, "Error: OAuth token has expired")).toBe("auth");
  });

  it("returns 'auth' when log contains authentication error (case-insensitive)", () => {
    expect(classifyAutomationError(1, "Authentication Error occurred")).toBe("auth");
  });

  it("returns 'auth' when log contains authentication failed", () => {
    expect(classifyAutomationError(1, "Authentication failed for user")).toBe("auth");
  });

  it("returns 'general' for non-auth errors", () => {
    expect(classifyAutomationError(1, "Syntax error in script")).toBe("general");
  });

  it("returns 'general' when exit code is 0", () => {
    expect(classifyAutomationError(0, "OAuth token has expired")).toBe("general");
  });

  it("returns 'general' when logTail is null", () => {
    expect(classifyAutomationError(1, null)).toBe("general");
  });

  it("returns 'general' when logTail is empty", () => {
    expect(classifyAutomationError(1, "")).toBe("general");
  });
});

describe("buildAutomationErrorMessage", () => {
  it("returns actionable auth message for auth errors", () => {
    const msg = buildAutomationErrorMessage({
      status: "completed",
      exitCode: 1,
      startedAt: "2025-01-01T00:00:00Z",
      finishedAt: "2025-01-01T00:05:00Z",
      errorCategory: "auth",
    });
    expect(msg).toContain("authentication error");
    expect(msg).toContain("claude /login");
    expect(msg).toContain("setup-token");
  });

  it("returns generic error for general errors", () => {
    const msg = buildAutomationErrorMessage({
      status: "completed",
      exitCode: 1,
      startedAt: "2025-01-01T00:00:00Z",
      finishedAt: "2025-01-01T00:05:00Z",
      errorCategory: "general",
    });
    expect(msg).toBe("Agent exited with code 1");
    expect(msg).not.toContain("authentication");
  });

  it("returns generic error when errorCategory is absent", () => {
    const msg = buildAutomationErrorMessage({
      status: "completed",
      exitCode: 2,
      startedAt: "2025-01-01T00:00:00Z",
      finishedAt: "2025-01-01T00:05:00Z",
    });
    expect(msg).toBe("Agent exited with code 2");
  });

  it("returns no-result message when result is null", () => {
    const msg = buildAutomationErrorMessage(null);
    expect(msg).toContain("without producing a result file");
  });

  it("returns empty string for exit code 0", () => {
    const msg = buildAutomationErrorMessage({
      status: "completed",
      exitCode: 0,
      startedAt: "2025-01-01T00:00:00Z",
      finishedAt: "2025-01-01T00:05:00Z",
    });
    expect(msg).toBe("");
  });
});
