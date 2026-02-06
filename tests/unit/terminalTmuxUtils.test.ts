import { describe, expect, it } from "vitest";
import {
  buildTmuxBootstrapCommand,
  sanitizeTmuxSessionNameForShell,
} from "../../src/lib/utils/terminalTmux";

describe("terminal tmux utils", () => {
  it("sanitizes session names", () => {
    expect(sanitizeTmuxSessionNameForShell("abc/def?ghi", "x")).toBe("abc_def_ghi");
    expect(sanitizeTmuxSessionNameForShell(undefined, "project-1")).toBe("divergence-project-1");
  });

  it("includes required bootstrap command parts", () => {
    const command = buildTmuxBootstrapCommand();
    expect(command).toContain("tmux has-session");
    expect(command).toContain("history-limit");
    expect(command).toContain("exec tmux attach");
    expect(command).toContain("tmux not found, starting zsh");
  });
});
