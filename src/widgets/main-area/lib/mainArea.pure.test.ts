import { describe, expect, it } from "vitest";
import {
  formatBytes,
  getAggregatedTerminalStatus,
  joinSessionPath,
} from "./mainArea.pure";

describe("main area utils", () => {
  it("joins session paths", () => {
    expect(joinSessionPath("/root", "src/file.ts")).toBe("/root/src/file.ts");
    expect(joinSessionPath("/root/", "src/file.ts")).toBe("/root/src/file.ts");
    expect(joinSessionPath("C:\\root", "src\\file.ts")).toBe("C:\\root\\src\\file.ts");
    expect(joinSessionPath("/root", "/absolute/file.ts")).toBe("/absolute/file.ts");
  });

  it("formats byte sizes", () => {
    expect(formatBytes(10)).toBe("10 B");
    expect(formatBytes(1024)).toBe("1.0 KB");
    expect(formatBytes(1024 * 1024)).toBe("1.0 MB");
  });

  it("aggregates terminal statuses", () => {
    expect(getAggregatedTerminalStatus(["idle", "active"])).toBe("active");
    expect(getAggregatedTerminalStatus(["busy", "idle", "active"])).toBe("busy");
    expect(getAggregatedTerminalStatus(["idle", "idle", "idle"])).toBe("idle");
  });
});
