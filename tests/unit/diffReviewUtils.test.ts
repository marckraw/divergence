import { describe, expect, it } from "vitest";
import {
  buildAnchorLabel,
  buildReviewBriefMarkdown,
  groupCommentsByFile,
  parseUnifiedDiffLines,
} from "../../src/features/diff-review/lib/diffReview.pure";
import type { DiffReviewComment } from "../../src/features/diff-review";

describe("diff review utils", () => {
  it("parses unified diff lines with line numbers", () => {
    const parsed = parseUnifiedDiffLines([
      "diff --git a/a.ts b/a.ts",
      "@@ -1,2 +1,3 @@",
      " line1",
      "-line2",
      "+line2 changed",
      "+line3",
    ].join("\n"));

    expect(parsed[0]?.kind).toBe("meta");
    expect(parsed[1]?.kind).toBe("hunk");
    expect(parsed[2]?.oldLine).toBe(1);
    expect(parsed[2]?.newLine).toBe(1);
    expect(parsed[3]?.kind).toBe("removed");
    expect(parsed[3]?.oldLine).toBe(2);
    expect(parsed[4]?.kind).toBe("added");
    expect(parsed[4]?.newLine).toBe(2);
  });

  it("builds anchor labels", () => {
    expect(buildAnchorLabel({
      filePath: "a.ts",
      mode: "working",
      lineKind: "added",
      newLine: 12,
      displayLineIndex: 1,
    })).toBe("+12");

    expect(buildAnchorLabel({
      filePath: "a.ts",
      mode: "working",
      lineKind: "removed",
      oldLine: 4,
      displayLineIndex: 2,
    })).toBe("-4");

    expect(buildAnchorLabel({
      filePath: "a.ts",
      mode: "working",
      lineKind: "file",
      displayLineIndex: 0,
    })).toBe("File-level");
  });

  it("groups comments by file", () => {
    const comments: DiffReviewComment[] = [
      {
        id: "2",
        message: "two",
        createdAt: "2026-01-01",
        anchor: {
          filePath: "b.ts",
          mode: "working",
          lineKind: "added",
          displayLineIndex: 2,
          newLine: 2,
        },
      },
      {
        id: "1",
        message: "one",
        createdAt: "2026-01-01",
        anchor: {
          filePath: "a.ts",
          mode: "working",
          lineKind: "removed",
          displayLineIndex: 10,
          oldLine: 10,
        },
      },
    ];

    const grouped = groupCommentsByFile(comments);
    expect(grouped[0]?.filePath).toBe("a.ts");
    expect(grouped[1]?.filePath).toBe("b.ts");
  });

  it("builds markdown brief", () => {
    const markdown = buildReviewBriefMarkdown({
      workspacePath: "/repo",
      mode: "working",
      comments: [
        {
          id: "1",
          message: "Fix this",
          createdAt: "2026-01-01",
          anchor: {
            filePath: "src/a.ts",
            mode: "working",
            lineKind: "added",
            displayLineIndex: 3,
            newLine: 3,
          },
        },
      ],
      finalComment: "Please keep tests green.",
    });

    expect(markdown).toContain("# Diff Review Brief");
    expect(markdown).toContain("src/a.ts");
    expect(markdown).toContain("Please keep tests green.");
  });
});
