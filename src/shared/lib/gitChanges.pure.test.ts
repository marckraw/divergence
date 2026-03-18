import { describe, expect, it } from "vitest";
import type { GitChangeEntry } from "./gitChanges.pure";
import {
  getRelativePathFromRoot,
  normalizeGitChangePath,
  sortGitChangesByPath,
} from "./gitChanges.pure";

describe("gitChanges.pure", () => {
  it("normalizes git paths to forward-slash relative paths", () => {
    expect(normalizeGitChangePath("\\src\\app\\App.tsx")).toBe("src/app/App.tsx");
    expect(normalizeGitChangePath("/package.json")).toBe("package.json");
  });

  it("computes relative paths from a root path", () => {
    expect(getRelativePathFromRoot("/a/b", "/a/b/src/main.ts")).toBe("src/main.ts");
    expect(getRelativePathFromRoot("C:\\a\\b", "C:\\a\\b\\src\\main.ts")).toBe("src\\main.ts");
    expect(getRelativePathFromRoot("/a/b", "/x/y")).toBeNull();
  });

  it("sorts changed entries by path", () => {
    const entries: GitChangeEntry[] = [
      { path: "z.txt", status: "M", staged: false, unstaged: true, untracked: false },
      { path: "a.txt", status: "A", staged: false, unstaged: true, untracked: false },
    ];

    expect(sortGitChangesByPath(entries).map((entry) => entry.path)).toEqual(["a.txt", "z.txt"]);
  });
});
