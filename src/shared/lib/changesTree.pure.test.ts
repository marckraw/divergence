import { describe, expect, it } from "vitest";
import type { GitChangeEntry } from "./gitChanges.pure";
import { buildChangesTree, collectChangesTreeFolderPaths } from "./changesTree.pure";

function makeEntry(partial: Partial<GitChangeEntry>): GitChangeEntry {
  return {
    path: partial.path ?? "src/index.ts",
    old_path: partial.old_path,
    status: partial.status ?? "M",
    staged: partial.staged ?? false,
    unstaged: partial.unstaged ?? true,
    untracked: partial.untracked ?? false,
  };
}

describe("changesTree.pure", () => {
  it("returns an empty tree for no changes", () => {
    expect(buildChangesTree([])).toEqual([]);
    expect(collectChangesTreeFolderPaths([])).toEqual([]);
  });

  it("keeps root files at the root level", () => {
    const tree = buildChangesTree([makeEntry({ path: "package.json" })]);

    expect(tree).toEqual([
      {
        kind: "file",
        name: "package.json",
        path: "package.json",
        entry: makeEntry({ path: "package.json" }),
      },
    ]);
  });

  it("builds nested folders for changed file paths", () => {
    const entries = [
      makeEntry({ path: "src/app/App.tsx", status: "M" }),
      makeEntry({ path: "src/shared/api/fs.api.ts", status: "A" }),
      makeEntry({ path: "README.md", status: "M" }),
    ];

    const tree = buildChangesTree(entries);

    expect(tree[0]).toMatchObject({
      kind: "folder",
      name: "src",
      path: "src",
    });
    expect(tree[1]).toMatchObject({
      kind: "file",
      path: "README.md",
    });

    const srcFolder = tree[0];
    if (srcFolder?.kind !== "folder") {
      throw new Error("Expected a folder at tree[0]");
    }

    expect(srcFolder.children).toMatchObject([
      { kind: "folder", name: "app", path: "src/app" },
      { kind: "folder", name: "shared", path: "src/shared" },
    ]);
  });

  it("groups multiple files in the same folder and sorts folders before files", () => {
    const tree = buildChangesTree([
      makeEntry({ path: "src/zeta.ts" }),
      makeEntry({ path: "src/alpha.ts" }),
      makeEntry({ path: "docs/spec.md" }),
      makeEntry({ path: "README.md" }),
    ]);

    expect(tree.map((node) => `${node.kind}:${node.path}`)).toEqual([
      "folder:docs",
      "folder:src",
      "file:README.md",
    ]);

    const srcFolder = tree[1];
    if (srcFolder?.kind !== "folder") {
      throw new Error("Expected a folder at tree[1]");
    }

    expect(srcFolder.children.map((child) => child.path)).toEqual(["src/alpha.ts", "src/zeta.ts"]);
  });

  it("preserves original entries on file nodes, including rename metadata", () => {
    const renamed = makeEntry({
      path: "src/new-name.ts",
      old_path: "src/old-name.ts",
      status: "R",
    });

    const tree = buildChangesTree([renamed]);
    const srcFolder = tree[0];
    if (srcFolder?.kind !== "folder") {
      throw new Error("Expected a folder at tree[0]");
    }
    const fileNode = srcFolder.children[0];
    if (fileNode?.kind !== "file") {
      throw new Error("Expected a file child");
    }

    expect(fileNode.entry).toEqual(renamed);
  });

  it("collects folder paths for expand-by-default behavior", () => {
    const tree = buildChangesTree([
      makeEntry({ path: "src/features/changes-tree/ui/ChangesTree.presentational.tsx" }),
    ]);

    expect(collectChangesTreeFolderPaths(tree)).toEqual([
      "src",
      "src/features",
      "src/features/changes-tree",
      "src/features/changes-tree/ui",
    ]);
  });
});
