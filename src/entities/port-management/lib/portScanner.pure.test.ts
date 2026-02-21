import { describe, it, expect } from "vitest";
import { findNextFreePort, buildProxyHostname } from "./portScanner.pure";

describe("portScanner", () => {
  describe("findNextFreePort", () => {
    it("returns preferred port when available", () => {
      const allocated = new Set<number>();
      expect(findNextFreePort(allocated, 3100)).toBe(3100);
    });

    it("skips preferred port when already allocated", () => {
      const allocated = new Set([3100]);
      expect(findNextFreePort(allocated, 3100)).toBe(3101);
    });

    it("returns first port in range when no preferred port", () => {
      const allocated = new Set<number>();
      expect(findNextFreePort(allocated)).toBe(3100);
    });

    it("skips already allocated ports", () => {
      const allocated = new Set([3100, 3101, 3102]);
      expect(findNextFreePort(allocated)).toBe(3103);
    });

    it("returns null when range is fully allocated", () => {
      const allocated = new Set<number>();
      for (let i = 3100; i <= 3999; i++) {
        allocated.add(i);
      }
      expect(findNextFreePort(allocated)).toBeNull();
    });

    it("ignores preferred port outside range", () => {
      const allocated = new Set<number>();
      expect(findNextFreePort(allocated, 2000, 3100, 3999)).toBe(3100);
    });

    it("works with custom range", () => {
      const allocated = new Set<number>();
      expect(findNextFreePort(allocated, undefined, 8000, 8100)).toBe(8000);
    });

    it("respects preferred port within custom range", () => {
      const allocated = new Set<number>();
      expect(findNextFreePort(allocated, 8050, 8000, 8100)).toBe(8050);
    });
  });

  describe("buildProxyHostname", () => {
    it("builds hostname from project and branch names", () => {
      expect(buildProxyHostname("myproject", "feature-branch")).toBe(
        "feature-branch.myproject.divergence.localhost",
      );
    });

    it("sanitizes special characters", () => {
      expect(buildProxyHostname("My Project!", "feature/new-thing")).toBe(
        "feature-new-thing.my-project.divergence.localhost",
      );
    });

    it("converts to lowercase", () => {
      expect(buildProxyHostname("MyProject", "Feature-Branch")).toBe(
        "feature-branch.myproject.divergence.localhost",
      );
    });

    it("collapses multiple dashes", () => {
      expect(buildProxyHostname("my--project", "some---branch")).toBe(
        "some-branch.my-project.divergence.localhost",
      );
    });

    it("trims leading and trailing dashes", () => {
      expect(buildProxyHostname("-project-", "-branch-")).toBe(
        "branch.project.divergence.localhost",
      );
    });
  });
});
