import { describe, expect, it } from "vitest";
import { parseUnifiedDiffLines } from "./unifiedDiff.pure";

describe("unifiedDiff.pure", () => {
  it("parses unified diff hunks and tracks line numbers", () => {
    const parsed = parseUnifiedDiffLines([
      "diff --git a/src/a.ts b/src/a.ts",
      "@@ -2,2 +2,3 @@",
      " line2",
      "-line3",
      "+line3 updated",
      "+line4",
      "\\ No newline at end of file",
    ].join("\n"));

    expect(parsed.map((line) => line.kind)).toEqual([
      "meta",
      "hunk",
      "context",
      "removed",
      "added",
      "added",
      "meta",
    ]);
    expect(parsed[2]?.oldLine).toBe(2);
    expect(parsed[2]?.newLine).toBe(2);
    expect(parsed[3]?.oldLine).toBe(3);
    expect(parsed[4]?.newLine).toBe(3);
    expect(parsed[5]?.newLine).toBe(4);
  });

  it("returns an empty list for empty input", () => {
    expect(parseUnifiedDiffLines(null)).toEqual([]);
  });
});
