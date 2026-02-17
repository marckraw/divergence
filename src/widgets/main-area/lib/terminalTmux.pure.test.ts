import { describe, expect, it } from "vitest";
import {
  buildTmuxBootstrapCommand,
  sanitizeTmuxSessionNameForShell,
  SHELL_BOOTSTRAP_TIMEOUT_MS,
  TMUX_BOOTSTRAP_TIMEOUT_MS,
  buildBootstrapTimeoutMessage,
} from "./terminalTmux.pure";

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

  it("exports bootstrap timeout constant", () => {
    expect(TMUX_BOOTSTRAP_TIMEOUT_MS).toBe(15_000);
    expect(SHELL_BOOTSTRAP_TIMEOUT_MS).toBe(20_000);
  });

  it("builds bootstrap timeout message with seconds and stalled hint", () => {
    const msg = buildBootstrapTimeoutMessage(15_000);
    expect(msg).toContain("15s");
    expect(msg).toContain("stalled");
  });

  it("rounds timeout message to nearest second", () => {
    const msg = buildBootstrapTimeoutMessage(7_500);
    expect(msg).toContain("8s");
  });
});
