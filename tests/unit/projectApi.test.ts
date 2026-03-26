import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockInvoke,
  mockOrderBy,
  mockFrom,
  mockSelect,
} = vi.hoisted(() => ({
  mockInvoke: vi.fn(),
  mockOrderBy: vi.fn(),
  mockFrom: vi.fn(),
  mockSelect: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: mockInvoke,
}));

vi.mock("../../src/shared/api/drizzle.api", () => ({
  db: {
    select: mockSelect,
  },
}));

import { listProjects } from "../../src/entities/project/api/project.api";

describe("project.api", () => {
  const project = {
    id: 1,
    name: "divergence",
    path: "/Users/marckraw/Projects/divergence",
    createdAt: "2026-03-25T21:00:00Z",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockSelect.mockReturnValue({ from: mockFrom });
    mockFrom.mockReturnValue({ orderBy: mockOrderBy });
  });

  it("returns plugin-sql rows when available", async () => {
    mockOrderBy.mockResolvedValue([project]);

    await expect(listProjects()).resolves.toEqual([project]);
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it("falls back to the Rust command when plugin-sql returns an empty list", async () => {
    mockOrderBy.mockResolvedValue([]);
    mockInvoke.mockResolvedValue([project]);

    await expect(listProjects()).resolves.toEqual([project]);
    expect(mockInvoke).toHaveBeenCalledWith("list_projects");
  });

  it("falls back to the Rust command when plugin-sql throws", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    mockOrderBy.mockRejectedValue(new Error("query failed"));
    mockInvoke.mockResolvedValue([project]);

    await expect(listProjects()).resolves.toEqual([project]);
    expect(mockInvoke).toHaveBeenCalledWith("list_projects");
    expect(warnSpy).toHaveBeenCalled();

    warnSpy.mockRestore();
  });
});
