import { describe, expect, it } from "vitest";
import type { Divergence, Project, WorkspaceSession } from "../../../types";
import {
  buildCommandCenterSearchResults,
  filterCommandCenterSearchResults,
  getFileInfo,
  groupResultsByCategory,
  joinRootWithRelativePath,
} from "./commandCenter.pure";
import { buildCommandCenterCreateActions } from "./commandCenterActions.pure";

const projects: Project[] = [
  { id: 1, name: "Alpha", path: "/alpha", createdAt: "2026-01-01" },
  { id: 2, name: "Beta", path: "/beta", createdAt: "2026-01-01" },
];

const divergences = new Map<number, Divergence[]>([
  [
    1,
    [
      {
        id: 10,
        projectId: 1,
        name: "Alpha Div",
        branch: "feat/search",
        path: "/alpha/feat-search",
        createdAt: "2026-01-01",
        hasDiverged: false,
      },
    ],
  ],
]);

const sessions = new Map<string, WorkspaceSession>([
  ["divergence-10", {
    id: "divergence-10",
    type: "divergence",
    targetId: 10,
    projectId: 1,
    workspaceKey: "divergence:10",
    sessionRole: "default",
    name: "Alpha Div",
    path: "/alpha/feat-search",
    useTmux: true,
    tmuxSessionName: "divergence-branch-alpha-feat-search-10",
    tmuxHistoryLimit: 50000,
    status: "idle",
  }],
]);

describe("buildCommandCenterSearchResults", () => {
  it("builds results for replace mode with all categories", () => {
    const items = buildCommandCenterSearchResults(
      { kind: "replace", targetPaneId: "stage-pane-1" },
      { projects, divergencesByProject: divergences, sessions },
    );
    const types = new Set(items.map((i) => i.type));
    expect(types.has("session")).toBe(true);
    expect(types.has("project")).toBe(true);
    expect(types.has("divergence")).toBe(true);
    expect(types.has("create_action")).toBe(true);
  });

  it("builds results for reveal mode with only sessions and workspaces", () => {
    const items = buildCommandCenterSearchResults(
      { kind: "reveal" },
      { projects, divergencesByProject: divergences, sessions },
    );
    const types = new Set(items.map((i) => i.type));
    expect(types.has("session")).toBe(true);
    expect(types.has("project")).toBe(false);
    expect(types.has("divergence")).toBe(false);
    expect(types.has("create_action")).toBe(false);
  });

  it("builds results for open-file mode with only files", () => {
    const items = buildCommandCenterSearchResults(
      { kind: "open-file", rootPath: "/alpha" },
      {
        projects,
        divergencesByProject: divergences,
        sessions,
        files: ["src/index.ts", "src/app.tsx"],
      },
    );
    expect(items).toHaveLength(2);
    expect(items.every((i) => i.type === "file")).toBe(true);
  });

  it("includes files in replace mode when provided", () => {
    const items = buildCommandCenterSearchResults(
      { kind: "replace", targetPaneId: "stage-pane-1" },
      {
        projects,
        divergencesByProject: divergences,
        sessions,
        files: ["README.md"],
      },
    );
    expect(items.some((i) => i.type === "file")).toBe(true);
  });
});

describe("filterCommandCenterSearchResults", () => {
  it("returns all items when query is empty", () => {
    const items = buildCommandCenterSearchResults(
      { kind: "replace", targetPaneId: "stage-pane-1" },
      { projects, divergencesByProject: divergences, sessions },
    );
    expect(filterCommandCenterSearchResults(items, "  ")).toHaveLength(items.length);
  });

  it("filters by project name", () => {
    const items = buildCommandCenterSearchResults(
      { kind: "replace", targetPaneId: "stage-pane-1" },
      { projects, divergencesByProject: divergences, sessions },
    );
    const filtered = filterCommandCenterSearchResults(items, "beta");
    expect(filtered.length).toBeGreaterThan(0);
    expect(filtered.some((i) => i.type === "project")).toBe(true);
  });

  it("filters by divergence branch", () => {
    const items = buildCommandCenterSearchResults(
      { kind: "replace", targetPaneId: "stage-pane-1" },
      { projects, divergencesByProject: divergences, sessions },
    );
    const filtered = filterCommandCenterSearchResults(items, "feat/search");
    expect(filtered.some((i) => i.type === "divergence")).toBe(true);
  });

  it("filters by file path", () => {
    const items = buildCommandCenterSearchResults(
      { kind: "open-file", rootPath: "/alpha" },
      {
        projects,
        divergencesByProject: divergences,
        sessions,
        files: ["src/index.ts", "src/app.tsx"],
      },
    );
    const filtered = filterCommandCenterSearchResults(items, "app");
    expect(filtered).toHaveLength(1);
  });

  it("filters by active category", () => {
    const items = buildCommandCenterSearchResults(
      { kind: "replace", targetPaneId: "stage-pane-1" },
      { projects, divergencesByProject: divergences, sessions },
    );
    const createOnly = filterCommandCenterSearchResults(items, "", "create");
    expect(createOnly.every((i) => i.category === "create")).toBe(true);
    expect(createOnly.length).toBeGreaterThan(0);
  });

  it("filters by create action label", () => {
    const items = buildCommandCenterSearchResults(
      { kind: "replace", targetPaneId: "stage-pane-1" },
      { projects, divergencesByProject: divergences, sessions },
    );
    const filtered = filterCommandCenterSearchResults(items, "terminal");
    expect(filtered.some((i) => i.type === "create_action")).toBe(true);
  });
});

describe("groupResultsByCategory", () => {
  it("groups items into sections", () => {
    const items = buildCommandCenterSearchResults(
      { kind: "replace", targetPaneId: "stage-pane-1" },
      { projects, divergencesByProject: divergences, sessions },
    );
    const groups = groupResultsByCategory(items);
    expect(groups.length).toBeGreaterThan(0);
    expect(groups.every((g) => g.items.length > 0)).toBe(true);
  });

  it("omits empty groups", () => {
    const items = buildCommandCenterSearchResults(
      { kind: "reveal" },
      { projects, divergencesByProject: divergences, sessions },
    );
    const groups = groupResultsByCategory(items);
    expect(groups.every((g) => g.items.length > 0)).toBe(true);
    // Reveal mode has no files or create actions
    expect(groups.find((g) => g.label === "Files")).toBeUndefined();
    expect(groups.find((g) => g.label === "Create New")).toBeUndefined();
  });
});

describe("getFileInfo", () => {
  it("extracts file info from path", () => {
    const info = getFileInfo("src/components/App.tsx");
    expect(info.fileName).toBe("App.tsx");
    expect(info.directory).toBe("src/components");
    expect(info.extension).toBe("tsx");
  });

  it("handles files without directory", () => {
    const info = getFileInfo("README.md");
    expect(info.fileName).toBe("README.md");
    expect(info.directory).toBe("");
    expect(info.extension).toBe("md");
  });

  it("handles files without extension", () => {
    const info = getFileInfo("Makefile");
    expect(info.fileName).toBe("Makefile");
    expect(info.extension).toBe("");
  });
});

describe("joinRootWithRelativePath", () => {
  it("joins forward-slash paths", () => {
    expect(joinRootWithRelativePath("/root/project", "src/file.ts")).toBe("/root/project/src/file.ts");
  });

  it("strips trailing slashes from root", () => {
    expect(joinRootWithRelativePath("/root/project/", "src/file.ts")).toBe("/root/project/src/file.ts");
  });

  it("strips leading slashes from relative", () => {
    expect(joinRootWithRelativePath("/root/project", "/src/file.ts")).toBe("/root/project/src/file.ts");
  });

  it("handles backslash paths", () => {
    expect(joinRootWithRelativePath("C:\\project", "src\\file.ts")).toBe("C:\\project\\src\\file.ts");
  });
});

describe("buildCommandCenterCreateActions", () => {
  it("returns create actions with terminal and agent options", () => {
    const actions = buildCommandCenterCreateActions();
    expect(actions.length).toBeGreaterThan(0);
    expect(actions.some((a) => a.sessionKind === "terminal")).toBe(true);
    expect(actions.some((a) => a.sessionKind === "agent")).toBe(true);
  });
});
