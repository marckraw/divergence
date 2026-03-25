import { describe, expect, it } from "vitest";
import {
  appendTerminalContextToPrompt,
  buildTerminalContextBlock,
  formatTerminalContextLineRange,
  normalizeTerminalContextText,
  sanitizeTerminalContexts,
} from "./terminalContext.pure";

describe("terminalContext.pure", () => {
  it("normalizes pasted terminal selections", () => {
    expect(normalizeTerminalContextText("  npm run build\r\nerror  \r\n")).toBe("npm run build\nerror");
  });

  it("formats line ranges when positions are available", () => {
    expect(formatTerminalContextLineRange({ lineStart: 18, lineEnd: 18 })).toBe("line 18");
    expect(formatTerminalContextLineRange({ lineStart: 18, lineEnd: 22 })).toBe("lines 18-22");
    expect(formatTerminalContextLineRange({ lineStart: null, lineEnd: 22 })).toBeNull();
  });

  it("builds a numbered terminal context block", () => {
    expect(buildTerminalContextBlock([
      {
        sourceSessionName: "api-dev",
        lineStart: 120,
        lineEnd: 121,
        text: "npm run build\nerror: failed",
      },
    ])).toBe([
      "<terminal_context>",
      "- api-dev lines 120-121:",
      "  120 | npm run build",
      "  121 | error: failed",
      "</terminal_context>",
    ].join("\n"));
  });

  it("appends sanitized terminal context blocks to prompts", () => {
    expect(appendTerminalContextToPrompt("Please investigate", [
      {
        sourceSessionName: "web",
        text: " \nwarning\n ",
      },
    ])).toBe([
      "Please investigate",
      "",
      "<terminal_context>",
      "- web:",
      "  warning",
      "</terminal_context>",
    ].join("\n"));
  });

  it("drops empty terminal contexts after normalization", () => {
    expect(sanitizeTerminalContexts([
      {
        sourceSessionName: "alpha",
        text: "   ",
      },
      {
        sourceSessionName: "beta",
        text: "value",
      },
    ])).toEqual([
      {
        sourceSessionName: "beta",
        text: "value",
      },
    ]);
  });
});
