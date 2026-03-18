import { describe, expect, it } from "vitest";
import { getBaseName, getFileBadgeInfo } from "./fileInfo.pure";

describe("fileInfo.pure", () => {
  it("derives base names from unix and windows paths", () => {
    expect(getBaseName("/a/b/file.ts")).toBe("file.ts");
    expect(getBaseName("C:\\a\\b\\file.ts")).toBe("file.ts");
  });

  it("resolves file badges from special names and extensions", () => {
    expect(getFileBadgeInfo(".env.local").label).toBe("ENV");
    expect(getFileBadgeInfo("package.json").label).toBe("NPM");
    expect(getFileBadgeInfo("custom.longext").label).toBe("LONG");
    expect(getFileBadgeInfo("README").label).toBe("READ");
  });
});
