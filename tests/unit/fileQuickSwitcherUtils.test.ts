import { describe, expect, it } from "vitest";
import {
  filterFilesByQuery,
  getFileQuickSwitcherInfo,
  joinRootWithRelativePath,
} from "../../src/lib/utils/fileQuickSwitcher";

describe("file quick switcher utils", () => {
  it("filters files by query", () => {
    const files = ["src/main.ts", "README.md"];
    expect(filterFilesByQuery(files, "main")).toEqual(["src/main.ts"]);
    expect(filterFilesByQuery(files, "  ")).toEqual(files);
  });

  it("joins root and relative path", () => {
    expect(joinRootWithRelativePath("/root", "src/main.ts")).toBe("/root/src/main.ts");
    expect(joinRootWithRelativePath("C:\\root", "src\\main.ts")).toBe("C:\\root\\src\\main.ts");
  });

  it("extracts file info", () => {
    expect(getFileQuickSwitcherInfo("src/main.ts")).toEqual({
      fileName: "main.ts",
      directory: "src",
      extension: "ts",
    });
    expect(getFileQuickSwitcherInfo("README").extension).toBe("");
  });
});
