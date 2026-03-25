import { describe, expect, it } from "vitest";
import { collectSessionChangedFiles } from "./agentSessionChangedFiles.pure";

describe("collectSessionChangedFiles", () => {
  it("returns empty array when no activities", () => {
    expect(collectSessionChangedFiles([])).toEqual([]);
  });

  it("returns empty array when no edit activities exist", () => {
    const result = collectSessionChangedFiles([
      {
        id: "a1",
        kind: "tool",
        title: "Read",
        summary: "Read README.md",
        subject: "README.md",
        groupKey: "read",
        status: "completed",
        startedAtMs: 100,
      },
      {
        id: "a2",
        kind: "tool",
        title: "Search",
        groupKey: "search",
        status: "completed",
        startedAtMs: 200,
      },
    ]);

    expect(result).toEqual([]);
  });

  it("collects unique file paths from edit activities", () => {
    const result = collectSessionChangedFiles([
      {
        id: "a1",
        kind: "tool",
        title: "Edit",
        summary: "Edited src/index.ts",
        subject: "src/index.ts",
        groupKey: "edit",
        status: "completed",
        startedAtMs: 100,
      },
      {
        id: "a2",
        kind: "tool",
        title: "Edit",
        summary: "Edited src/utils.ts",
        subject: "src/utils.ts",
        groupKey: "edit",
        status: "completed",
        startedAtMs: 200,
      },
    ]);

    expect(result).toEqual([
      { path: "src/index.ts", editCount: 1 },
      { path: "src/utils.ts", editCount: 1 },
    ]);
  });

  it("deduplicates and counts multiple edits to the same file", () => {
    const result = collectSessionChangedFiles([
      {
        id: "a1",
        kind: "tool",
        title: "Edit",
        subject: "src/index.ts",
        groupKey: "edit",
        status: "completed",
        startedAtMs: 100,
      },
      {
        id: "a2",
        kind: "tool",
        title: "Edit",
        subject: "src/index.ts",
        groupKey: "edit",
        status: "completed",
        startedAtMs: 200,
      },
      {
        id: "a3",
        kind: "tool",
        title: "Edit",
        subject: "src/index.ts",
        groupKey: "edit",
        status: "completed",
        startedAtMs: 300,
      },
    ]);

    expect(result).toEqual([
      { path: "src/index.ts", editCount: 3 },
    ]);
  });

  it("ignores activities without a subject", () => {
    const result = collectSessionChangedFiles([
      {
        id: "a1",
        kind: "tool",
        title: "Edit",
        groupKey: "edit",
        status: "completed",
        startedAtMs: 100,
      },
    ]);

    expect(result).toEqual([]);
  });

  it("ignores activities without a groupKey", () => {
    const result = collectSessionChangedFiles([
      {
        id: "a1",
        kind: "tool",
        title: "Edit",
        subject: "src/index.ts",
        status: "completed",
        startedAtMs: 100,
      },
    ]);

    expect(result).toEqual([]);
  });

  it("mixes edit and non-edit activities correctly", () => {
    const result = collectSessionChangedFiles([
      {
        id: "a1",
        kind: "tool",
        title: "Read",
        subject: "README.md",
        groupKey: "read",
        status: "completed",
        startedAtMs: 100,
      },
      {
        id: "a2",
        kind: "tool",
        title: "Edit",
        subject: "src/app.tsx",
        groupKey: "edit",
        status: "completed",
        startedAtMs: 200,
      },
      {
        id: "a3",
        kind: "tool",
        title: "Search",
        subject: "src/utils.ts",
        groupKey: "search",
        status: "completed",
        startedAtMs: 300,
      },
      {
        id: "a4",
        kind: "tool",
        title: "Edit",
        subject: "src/app.tsx",
        groupKey: "edit",
        status: "completed",
        startedAtMs: 400,
      },
    ]);

    expect(result).toEqual([
      { path: "src/app.tsx", editCount: 2 },
    ]);
  });
});
