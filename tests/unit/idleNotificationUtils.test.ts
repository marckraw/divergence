import { describe, expect, it } from "vitest";
import { buildIdleNotificationTargetLabel, shouldNotifyIdle } from "../../src/app/lib/idleNotification.pure";

describe("idle notification utils", () => {
  it("applies gating rules", () => {
    const base = {
      sessionExists: true,
      sessionStatus: "idle" as const,
      durationMs: 6000,
      notifyMinBusyMs: 5000,
      nowMs: 10000,
      lastNotifiedAtMs: 0,
      notifyCooldownMs: 3000,
      isWindowFocused: false,
      isSessionActive: false,
    };

    expect(shouldNotifyIdle(base)).toBe(true);
    expect(shouldNotifyIdle({ ...base, sessionStatus: "busy" })).toBe(false);
    expect(shouldNotifyIdle({ ...base, durationMs: 1000 })).toBe(false);
    expect(shouldNotifyIdle({ ...base, lastNotifiedAtMs: 9000 })).toBe(false);
    expect(shouldNotifyIdle({ ...base, isWindowFocused: true, isSessionActive: true })).toBe(false);
  });

  it("builds target labels", () => {
    expect(buildIdleNotificationTargetLabel({ type: "project", name: "Alpha" }, "Alpha")).toBe("Alpha");
    expect(buildIdleNotificationTargetLabel({ type: "divergence", name: "feat/x" }, "Alpha")).toBe("Alpha / feat/x");
  });
});
