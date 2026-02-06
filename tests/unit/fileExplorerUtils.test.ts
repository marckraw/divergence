import { describe, expect, it } from "vitest";
import {
  getBaseName,
  getFileBadgeInfo,
  joinFileExplorerPath,
  normalizeFileExplorerEntry,
  sortFileExplorerEntries,
} from "../../src/lib/utils/fileExplorer";

describe("file explorer utils", () => {
  it("gets base names for unix and windows paths", () => {
    expect(getBaseName("/a/b/file.ts")).toBe("file.ts");
    expect(getBaseName("C:\\a\\b\\file.ts")).toBe("file.ts");
  });

  it("resolves badge info", () => {
    expect(getFileBadgeInfo(".env.local").label).toBe("ENV");
    expect(getFileBadgeInfo("package.json").label).toBe("NPM");
    expect(getFileBadgeInfo("custom.longext").label).toBe("LONG");
    expect(getFileBadgeInfo("README").label).toBe("READ");
  });

  it("joins and normalizes entries", () => {
    expect(joinFileExplorerPath("/root", "child.ts")).toBe("/root/child.ts");
    expect(joinFileExplorerPath("C:\\root", "child.ts")).toBe("C:\\root\\child.ts");

    const entry = normalizeFileExplorerEntry("/root/path", {
      name: null,
      isDirectory: true,
    } as never);

    expect(entry).toEqual({
      path: "/root/path/path",
      name: "path",
      isDir: true,
    });
  });

  it("sorts directories first then by name", () => {
    const sorted = sortFileExplorerEntries([
      { path: "b", name: "b", isDir: false },
      { path: "c", name: "c", isDir: true },
      { path: "a", name: "a", isDir: true },
    ]);

    expect(sorted.map((item) => `${item.isDir ? "d" : "f"}:${item.name}`)).toEqual([
      "d:a",
      "d:c",
      "f:b",
    ]);
  });
});
