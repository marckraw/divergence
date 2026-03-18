import { describe, expect, it } from "vitest";
import {
  buildImportLabel,
  formatFileSize,
  getDiffLineClass,
  getDirname,
  IMPORT_COMPLETION_EXTENSIONS,
  isImportCompletionEnabled,
  joinPath,
  normalizePath,
  resolvePath,
  trimTrailingSlash,
} from "./quickEdit.pure";

describe("quickEdit.pure", () => {
  it("normalizes and trims paths", () => {
    expect(normalizePath("a\\b\\c")).toBe("a/b/c");
    expect(trimTrailingSlash("/a/b///")).toBe("/a/b");
  });

  it("computes directory names", () => {
    expect(getDirname("/a/b/file.ts")).toBe("/a/b");
    expect(getDirname("/file.ts")).toBe("/");
    expect(getDirname("file.ts")).toBe(".");
    expect(getDirname("C:/file.ts")).toBe("C:/");
  });

  it("joins and resolves paths", () => {
    expect(joinPath("/a/b", "c.ts")).toBe("/a/b/c.ts");
    expect(joinPath("/a/b", "/x/y.ts")).toBe("/x/y.ts");
    expect(resolvePath("/a/b", "../c")).toBe("/a/c");
    expect(resolvePath("C:/a/b", "../c")).toBe("C:/a/c");
  });

  it("checks import completion eligibility", () => {
    expect(IMPORT_COMPLETION_EXTENSIONS.has(".ts")).toBe(true);
    expect(isImportCompletionEnabled("/a/file.tsx")).toBe(true);
    expect(isImportCompletionEnabled("/a/file.json")).toBe(false);
  });

  it("builds import labels", () => {
    expect(buildImportLabel("types.d.ts")).toBe("types");
    expect(buildImportLabel("index.ts")).toBe("index");
    expect(buildImportLabel("styles.css")).toBe("styles.css");
  });

  it("classifies diff lines and formats file sizes", () => {
    expect(getDiffLineClass("@@ -1,2 +1,2 @@")).toBe("text-accent");
    expect(getDiffLineClass("+line")).toBe("text-green bg-green/10");
    expect(getDiffLineClass("-line")).toBe("text-red bg-red/10");
    expect(formatFileSize(10)).toBe("10 B");
    expect(formatFileSize(1024)).toBe("1.0 KB");
    expect(formatFileSize(1024 * 1024)).toBe("1.0 MB");
  });
});
