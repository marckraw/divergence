import { describe, expect, it } from "vitest";
import type { GitChangeEntry } from "../../../types";
import {
  getRelativePathFromRoot,
  sortGitChangesByPath,
} from "./changes.pure";

describe("changes utils", () => {
  it("gets relative path from root", () => {
    expect(getRelativePathFromRoot("/a/b", "/a/b/src/main.ts")).toBe("src/main.ts");
    expect(getRelativePathFromRoot("C:\\a\\b", "C:\\a\\b\\src\\main.ts")).toBe("src\\main.ts");
    expect(getRelativePathFromRoot("/a/b", "/x/y")).toBeNull();
  });

  it("sorts git changes by path", () => {
    const entries: GitChangeEntry[] = [
      { path: "z.txt", status: "M", staged: false, unstaged: true, untracked: false },
      { path: "a.txt", status: "A", staged: true, unstaged: false, untracked: false },
    ];

    expect(sortGitChangesByPath(entries).map((entry) => entry.path)).toEqual(["a.txt", "z.txt"]);
  });

  it("sorts deterministically without locale-dependent collation", () => {
    const entries: GitChangeEntry[] = [
      { path: "ä.txt", status: "M", staged: false, unstaged: true, untracked: false },
      { path: "z.txt", status: "M", staged: false, unstaged: true, untracked: false },
      { path: "a.txt", status: "A", staged: true, unstaged: false, untracked: false },
    ];

    expect(sortGitChangesByPath(entries).map((entry) => entry.path)).toEqual(["a.txt", "z.txt", "ä.txt"]);
  });
});
