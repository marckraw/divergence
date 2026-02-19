import { describe, expect, it } from "vitest";
import { buildWorkspaceTerminalPresets } from "./terminalPresets.pure";

describe("buildWorkspaceTerminalPresets", () => {
  it("returns presets with workspace name", () => {
    const presets = buildWorkspaceTerminalPresets("My Project");
    expect(presets.length).toBeGreaterThanOrEqual(2);
    expect(presets[0].label).toBe("Claude (My Project)");
    expect(presets[0].command).toBe("claude");
  });

  it("includes a status preset", () => {
    const presets = buildWorkspaceTerminalPresets("Test");
    const statusPreset = presets.find((p) => p.label.includes("Status"));
    expect(statusPreset).toBeDefined();
    expect(statusPreset!.command).toContain("git status");
  });
});
