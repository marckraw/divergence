import { describe, expect, it } from "vitest";
import { normalizeSkipList } from "../../src/entities/project";

describe("project settings normalization", () => {
  it("trims, drops empties, and de-duplicates preserving order", () => {
    expect(normalizeSkipList([" node_modules ", "", "dist", "dist", "  ", "target"])).toEqual([
      "node_modules",
      "dist",
      "target",
    ]);
  });
});
