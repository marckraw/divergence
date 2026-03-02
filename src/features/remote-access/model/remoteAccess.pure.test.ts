import { describe, expect, it } from "vitest";
import {
  derivePairingCode,
  formatLastSeen,
  formatPairedAt,
  isSessionActive,
  mapSessionToDisplay,
  getRemainingSeconds,
  generateRandomToken,
} from "./remoteAccess.pure";

describe("generateRandomToken", () => {
  it("returns a 64-char hex string", () => {
    const token = generateRandomToken();
    expect(token).toHaveLength(64);
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  it("returns different values on each call", () => {
    const a = generateRandomToken();
    const b = generateRandomToken();
    expect(a).not.toBe(b);
  });
});

describe("derivePairingCode", () => {
  it("returns a 6-digit string", () => {
    const code = derivePairingCode("abc123hash");
    expect(code).toHaveLength(6);
    expect(code).toMatch(/^\d{6}$/);
  });
});

describe("formatLastSeen", () => {
  it("shows 'Just now' for recent timestamps", () => {
    expect(formatLastSeen(Date.now() - 10_000)).toBe("Just now");
  });

  it("shows minutes ago", () => {
    expect(formatLastSeen(Date.now() - 5 * 60_000)).toBe("5m ago");
  });

  it("shows hours ago", () => {
    expect(formatLastSeen(Date.now() - 2 * 3_600_000)).toBe("2h ago");
  });

  it("shows days ago", () => {
    expect(formatLastSeen(Date.now() - 3 * 86_400_000)).toBe("3d ago");
  });
});

describe("formatPairedAt", () => {
  it("formats a timestamp as a readable date", () => {
    const result = formatPairedAt(1709337600000); // Mar 2, 2024
    expect(result).toContain("2024");
  });
});

describe("isSessionActive", () => {
  it("returns true for recent activity", () => {
    expect(isSessionActive(Date.now() - 60_000)).toBe(true);
  });

  it("returns false for stale sessions", () => {
    expect(isSessionActive(Date.now() - 10 * 60_000)).toBe(false);
  });
});

describe("mapSessionToDisplay", () => {
  it("maps a DB session row to display format", () => {
    const result = mapSessionToDisplay({
      id: 1,
      deviceName: "iPad Pro",
      pairedAtMs: Date.now() - 86_400_000,
      lastSeenMs: Date.now() - 30_000,
      revoked: false,
    });

    expect(result.id).toBe(1);
    expect(result.deviceName).toBe("iPad Pro");
    expect(result.isActive).toBe(true);
    expect(result.revoked).toBe(false);
    expect(result.lastSeen).toBe("Just now");
  });

  it("marks revoked sessions as inactive", () => {
    const result = mapSessionToDisplay({
      id: 2,
      deviceName: "iPhone",
      pairedAtMs: Date.now() - 86_400_000,
      lastSeenMs: Date.now() - 30_000,
      revoked: true,
    });

    expect(result.isActive).toBe(false);
  });
});

describe("getRemainingSeconds", () => {
  it("returns 0 for null expiry", () => {
    expect(getRemainingSeconds(null)).toBe(0);
  });

  it("returns 0 for past expiry", () => {
    expect(getRemainingSeconds(Date.now() - 1000)).toBe(0);
  });

  it("returns positive seconds for future expiry", () => {
    const remaining = getRemainingSeconds(Date.now() + 60_000);
    expect(remaining).toBeGreaterThan(55);
    expect(remaining).toBeLessThanOrEqual(60);
  });
});
