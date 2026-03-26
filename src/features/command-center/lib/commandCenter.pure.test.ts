import { describe, expect, it } from "vitest";
import type { Divergence, Project, WorkspaceSession } from "../../../entities";
import type { CommandCenterMode } from "../ui/CommandCenter.types";
import {
  MAX_VISIBLE_RESULTS,
  buildCommandCenterSearchResults,
  filterCommandCenterSearchResults,
  getCommandCenterContextLabel,
  getFileAbsolutePath,
  getModeBadgeLabel,
  groupResultsByCategory,
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

const revealMode: CommandCenterMode = { kind: "reveal" };
const openFileMode: CommandCenterMode = { kind: "open-file", rootPath: "/alpha" };
const openInPaneMode: CommandCenterMode = { kind: "open-in-pane", targetPaneId: "stage-pane-2" };

describe("commandCenter.pure", () => {
  describe("MAX_VISIBLE_RESULTS", () => {
    it("exports the visible result cap used by the command center", () => {
      expect(MAX_VISIBLE_RESULTS).toBe(100);
      expect(MAX_VISIBLE_RESULTS).toBeGreaterThan(0);
    });
  });

  describe("buildCommandCenterSearchResults", () => {
    it("builds results for reveal mode with sessions and target navigation", () => {
      const items = buildCommandCenterSearchResults(revealMode, {
        projects,
        divergencesByProject: divergences,
        sessions,
        workspaces: [{ id: 1, name: "WS1", slug: "ws1", description: null, folderPath: "/ws1", createdAtMs: 1, updatedAtMs: 1 }],
        workspaceDivergences: [{
          id: 12,
          workspaceId: 1,
          name: "WS Div",
          branch: "feat/ws",
          folderPath: "/ws1/feat-ws",
          createdAtMs: 1,
        }],
      });

      expect(items.some((r) => r.type === "session")).toBe(true);
      expect(items.some((r) => r.type === "project")).toBe(true);
      expect(items.some((r) => r.type === "divergence")).toBe(true);
      expect(items.some((r) => r.type === "workspace")).toBe(true);
      expect(items.some((r) => r.type === "workspace_divergence")).toBe(true);
      expect(items.some((r) => r.type === "file")).toBe(false);
      expect(items.some((r) => r.type === "create_action")).toBe(false);
    });

    it("builds results for open-file mode with files only", () => {
      const items = buildCommandCenterSearchResults(openFileMode, {
        projects,
        divergencesByProject: divergences,
        sessions,
        files: ["src/main.ts", "README.md"],
      });

      expect(items).toHaveLength(2);
      expect(items.every((r) => r.type === "file")).toBe(true);
    });

    it("builds results for open-in-pane mode with sessions, files, and create actions", () => {
      const items = buildCommandCenterSearchResults(openInPaneMode, {
        projects,
        divergencesByProject: divergences,
        sessions,
        files: ["src/main.ts"],
        agentProviders: ["claude"],
        sourceSession: sessions.get("divergence-10") ?? null,
      });

      expect(items.some((r) => r.type === "session")).toBe(true);
      expect(items.some((r) => r.type === "file")).toBe(true);
      expect(items.some((r) => r.type === "create_action")).toBe(true);
      expect(items.some((r) => r.type === "project")).toBe(false);
    });
  });

  describe("filterCommandCenterSearchResults", () => {
    it("returns all items when query is empty", () => {
      const items = buildCommandCenterSearchResults(revealMode, {
        projects,
        divergencesByProject: divergences,
        sessions,
      });
      expect(filterCommandCenterSearchResults(items, "  ")).toEqual(items);
    });

    it("filters by text query", () => {
      const items = buildCommandCenterSearchResults(revealMode, {
        projects,
        divergencesByProject: divergences,
        sessions,
      });
      expect(filterCommandCenterSearchResults(items, "beta")).toHaveLength(1);
      expect(filterCommandCenterSearchResults(items, "alpha")).toHaveLength(3);
    });

    it("filters files by path", () => {
      const items = buildCommandCenterSearchResults(openFileMode, {
        projects,
        divergencesByProject: divergences,
        sessions,
        files: ["src/main.ts", "README.md"],
      });
      expect(filterCommandCenterSearchResults(items, "main")).toHaveLength(1);
    });

    it("supports fuzzy file queries with non-contiguous characters and word splits", () => {
      const items = buildCommandCenterSearchResults(openFileMode, {
        projects,
        divergencesByProject: divergences,
        sessions,
        files: [
          "src/features/command-center/ui/CommandCenter.container.tsx",
          "src/features/command-center/ui/CommandCenter.presentational.tsx",
          "src/main.ts",
        ],
      });

      const filtered = filterCommandCenterSearchResults(items, "cc cont");

      expect(filtered).toHaveLength(2);
      expect((filtered[0].item as { relativePath: string }).relativePath).toBe(
        "src/features/command-center/ui/CommandCenter.container.tsx",
      );
      expect(filtered[0].matchedIndices).toEqual([0, 7, 14, 15, 16, 17]);
      expect(filtered[0].score).toBeGreaterThan(0);
      expect(filtered[0].score).toBeGreaterThan(filtered[1].score ?? 0);
    });

    it("filters by category", () => {
      const items = buildCommandCenterSearchResults(openInPaneMode, {
        projects,
        divergencesByProject: divergences,
        sessions,
        files: ["src/main.ts"],
        agentProviders: ["claude"],
        sourceSession: sessions.get("divergence-10") ?? null,
      });
      const fileOnly = filterCommandCenterSearchResults(items, "", "files");
      expect(fileOnly.every((r) => r.type === "file")).toBe(true);

      const createOnly = filterCommandCenterSearchResults(items, "", "create");
      expect(createOnly.every((r) => r.type === "create_action")).toBe(true);
    });

    it("filters reveal results by target labels in reveal mode", () => {
      const items = buildCommandCenterSearchResults(revealMode, {
        projects,
        divergencesByProject: divergences,
        sessions,
        workspaces: [{ id: 1, name: "WS1", slug: "ws1", description: null, folderPath: "/ws1", createdAtMs: 1, updatedAtMs: 1 }],
      });
      const filtered = filterCommandCenterSearchResults(items, "ws1");
      expect(filtered.some((r) => r.type === "workspace")).toBe(true);
    });

    it("sorts results by score within each category when a query is present", () => {
      const items = buildCommandCenterSearchResults(openInPaneMode, {
        projects,
        divergencesByProject: divergences,
        sessions,
        files: [
          "src/CommandCenter.tsx",
          "src/features/command-center/ui/CommandCenter.tsx",
          "src/features/command-center/ui/CommandCenter.container.tsx",
        ],
        agentProviders: ["claude"],
        sourceSession: sessions.get("divergence-10") ?? null,
      });

      const filtered = filterCommandCenterSearchResults(items, "cc", "files");

      expect(filtered.map((result) => (result.item as { relativePath: string }).relativePath)).toEqual([
        "src/CommandCenter.tsx",
        "src/features/command-center/ui/CommandCenter.tsx",
        "src/features/command-center/ui/CommandCenter.container.tsx",
      ]);
      expect((filtered[0].score ?? 0)).toBeGreaterThan(filtered[1].score ?? 0);
      expect((filtered[1].score ?? 0)).toBeGreaterThanOrEqual(filtered[2].score ?? 0);
    });
  });

  describe("buildCommandCenterCreateActions", () => {
    it("builds create actions with terminal and agent options", () => {
      const session = sessions.get("divergence-10")!;
      const actions = buildCommandCenterCreateActions(session, ["claude", "codex"]);

      expect(actions).toHaveLength(3);
      expect(actions[0]).toEqual(expect.objectContaining({
        sessionKind: "terminal",
        targetType: "divergence",
        targetId: 10,
      }));
      expect(actions[1]).toEqual(expect.objectContaining({
        sessionKind: "agent",
        provider: "claude",
      }));
      expect(actions[2]).toEqual(expect.objectContaining({
        sessionKind: "agent",
        provider: "codex",
      }));
    });

    it("returns empty array without source session", () => {
      expect(buildCommandCenterCreateActions(null, ["claude"])).toEqual([]);
    });
  });

  describe("getFileAbsolutePath", () => {
    it("joins root and relative path", () => {
      expect(getFileAbsolutePath("/root", "src/main.ts")).toBe("/root/src/main.ts");
      expect(getFileAbsolutePath("C:\\root", "src\\main.ts")).toBe("C:\\root\\src\\main.ts");
    });

    it("handles trailing/leading separators", () => {
      expect(getFileAbsolutePath("/root/", "src/main.ts")).toBe("/root/src/main.ts");
      expect(getFileAbsolutePath("/root/", "/src/main.ts")).toBe("/root/src/main.ts");
    });
  });

  describe("getModeBadgeLabel", () => {
    it("returns correct labels for each mode", () => {
      expect(getModeBadgeLabel(revealMode)).toBe("Reveal");
      expect(getModeBadgeLabel(openInPaneMode)).toBe("Open");
      expect(getModeBadgeLabel(openFileMode)).toBe("File");
    });
  });

  describe("getCommandCenterContextLabel", () => {
    it("returns root path for open-file mode", () => {
      expect(getCommandCenterContextLabel(openFileMode, null)).toBe("/alpha");
    });

    it("returns session name when available", () => {
      const session = sessions.get("divergence-10")!;
      expect(getCommandCenterContextLabel(openInPaneMode, session)).toBe("Alpha Div");
    });
  });

  describe("groupResultsByCategory", () => {
    it("groups results in correct order", () => {
      const items = buildCommandCenterSearchResults(openInPaneMode, {
        projects,
        divergencesByProject: divergences,
        sessions,
        files: ["src/main.ts"],
        agentProviders: ["claude"],
        sourceSession: sessions.get("divergence-10") ?? null,
      });
      const groups = groupResultsByCategory(items);
      const categoryOrder = groups.map((g) => g.category);
      expect(categoryOrder).toEqual(["recent", "files", "create"]);
    });

    it("omits empty categories", () => {
      const items = buildCommandCenterSearchResults(openFileMode, {
        projects,
        divergencesByProject: divergences,
        sessions,
        files: ["src/main.ts"],
      });
      const groups = groupResultsByCategory(items);
      expect(groups).toHaveLength(1);
      expect(groups[0].category).toBe("files");
    });
  });
});
