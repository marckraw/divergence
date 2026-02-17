import { describe, expect, it } from "vitest";
import {
  shouldAutoReconnect,
  getReconnectDelayMs,
  MAX_AUTO_RECONNECT_ATTEMPTS,
} from "./terminalReconnect.pure";

describe("shouldAutoReconnect", () => {
  it("returns false when max attempts reached", () => {
    expect(shouldAutoReconnect(1, true, MAX_AUTO_RECONNECT_ATTEMPTS)).toBe(false);
    expect(shouldAutoReconnect(1, true, MAX_AUTO_RECONNECT_ATTEMPTS + 1)).toBe(false);
  });

  it("returns true for tmux sessions regardless of exit code", () => {
    expect(shouldAutoReconnect(0, true, 0)).toBe(true);
    expect(shouldAutoReconnect(1, true, 0)).toBe(true);
    expect(shouldAutoReconnect(137, true, 2)).toBe(true);
  });

  it("returns true for non-tmux sessions with non-zero exit code", () => {
    expect(shouldAutoReconnect(1, false, 0)).toBe(true);
    expect(shouldAutoReconnect(137, false, 3)).toBe(true);
  });

  it("returns false for non-tmux sessions with clean exit", () => {
    expect(shouldAutoReconnect(0, false, 0)).toBe(false);
  });
});

describe("getReconnectDelayMs", () => {
  it("returns increasing delays for successive attempts", () => {
    const d0 = getReconnectDelayMs(0);
    const d1 = getReconnectDelayMs(1);
    const d2 = getReconnectDelayMs(2);
    expect(d0).toBeLessThan(d1);
    expect(d1).toBeLessThan(d2);
  });

  it("caps delay at the last value for high attempt numbers", () => {
    const d10 = getReconnectDelayMs(10);
    const d100 = getReconnectDelayMs(100);
    expect(d10).toBe(d100);
  });

  it("returns 500 for first attempt", () => {
    expect(getReconnectDelayMs(0)).toBe(500);
  });
});
