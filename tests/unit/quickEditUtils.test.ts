import { describe, expect, it } from "vitest";
import {
  buildImportLabel,
  getDiffLineClass,
  getDirname,
  isImportCompletionEnabled,
  joinPath,
  normalizePath,
  resolvePath,
  trimTrailingSlash,
} from "../../src/widgets/main-area/lib/quickEdit.pure";

describe("quick edit utils", () => {
  it("normalizes and trims paths", () => {
    expect(normalizePath("a\\b\\c")).toBe("a/b/c");
    expect(trimTrailingSlash("/a/b///")).toBe("/a/b");
  });

  it("computes dirname", () => {
    expect(getDirname("/a/b/file.ts")).toBe("/a/b");
    expect(getDirname("/file.ts")).toBe("/");
    expect(getDirname("file.ts")).toBe("file.ts");
  });

  it("joins and resolves paths", () => {
    expect(joinPath("/a/b", "c.ts")).toBe("/a/b/c.ts");
    expect(joinPath("/a/b", "/x/y.ts")).toBe("/x/y.ts");
    expect(resolvePath("/a/b", "../c")).toBe("/a/c");
    expect(resolvePath("C:/a/b", "../c")).toBe("C:/a/c");
  });

  it("checks import completion eligibility", () => {
    expect(isImportCompletionEnabled("/a/file.tsx")).toBe(true);
    expect(isImportCompletionEnabled("/a/file.json")).toBe(false);
    expect(isImportCompletionEnabled(null)).toBe(false);
  });

  it("builds import labels", () => {
    expect(buildImportLabel("types.d.ts")).toBe("types");
    expect(buildImportLabel("index.ts")).toBe("index");
    expect(buildImportLabel("styles.css")).toBe("styles.css");
  });

  it("classifies diff lines", () => {
    expect(getDiffLineClass("@@ -1,2 +1,2 @@")).toBe("text-accent");
    expect(getDiffLineClass("+line")).toBe("text-green bg-green/10");
    expect(getDiffLineClass("-line")).toBe("text-red bg-red/10");
    expect(getDiffLineClass("diff --git a b")).toBe("text-subtext/70");
    expect(getDiffLineClass("plain text")).toBe("text-subtext/80");
  });
});
