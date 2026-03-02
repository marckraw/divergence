import { describe, expect, it, vi, afterEach } from "vitest";
import { queueCreateDivergence } from "../../src/features/create-divergence/service/createDivergence.service";
import { queueCreateWorkspaceDivergences } from "../../src/features/workspace-management/service/createWorkspaceDivergences.service";
import type { RunBackgroundTask } from "../../src/entities/task";
import type { Project, Workspace } from "../../src/entities";

function createRunTaskStub(promise: Promise<unknown>): RunBackgroundTask {
  return vi.fn(() => promise) as unknown as RunBackgroundTask;
}

const projectFixture = { id: 1, name: "demo", path: "/tmp/demo" } as unknown as Project;
const workspaceFixture = { id: 2, name: "workspace", slug: "workspace" } as unknown as Workspace;

describe("non-blocking divergence queue wrappers", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns immediately when queueing single divergence creation", async () => {
    let resolveTask: (() => void) | null = null;
    const runTaskPromise = new Promise<void>((resolve) => {
      resolveTask = resolve;
    });
    const runTask = createRunTaskStub(runTaskPromise);

    await expect(queueCreateDivergence({
      project: projectFixture,
      branchName: "feature/non-blocking",
      useExistingBranch: false,
      runTask,
      refreshDivergences: vi.fn().mockResolvedValue(undefined),
      refreshPortAllocations: vi.fn(),
    })).resolves.toBeUndefined();

    expect(runTask).toHaveBeenCalledTimes(1);
    resolveTask?.();
  });

  it("returns immediately when queueing workspace divergence creation", async () => {
    let resolveTask: (() => void) | null = null;
    const runTaskPromise = new Promise<void>((resolve) => {
      resolveTask = resolve;
    });
    const runTask = createRunTaskStub(runTaskPromise);

    await expect(queueCreateWorkspaceDivergences({
      workspace: workspaceFixture,
      memberProjects: [projectFixture],
      branchName: "feature/non-blocking",
      useExistingBranch: true,
      runTask,
      refreshDivergences: vi.fn().mockResolvedValue(undefined),
      refreshWorkspaces: vi.fn().mockResolvedValue(undefined),
      refreshPortAllocations: vi.fn(),
    })).resolves.toBeUndefined();

    expect(runTask).toHaveBeenCalledTimes(1);
    resolveTask?.();
  });

  it("logs queue failures without rejecting caller for single divergence", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const runTask = createRunTaskStub(Promise.reject(new Error("create failed")));

    await expect(queueCreateDivergence({
      project: projectFixture,
      branchName: "feature/failure",
      useExistingBranch: false,
      runTask,
      refreshDivergences: vi.fn().mockResolvedValue(undefined),
      refreshPortAllocations: vi.fn(),
    })).resolves.toBeUndefined();

    await Promise.resolve();
    expect(consoleError).toHaveBeenCalledWith("Create divergence task failed:", expect.any(Error));
  });

  it("logs queue failures without rejecting caller for workspace divergences", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const runTask = createRunTaskStub(Promise.reject(new Error("workspace create failed")));

    await expect(queueCreateWorkspaceDivergences({
      workspace: workspaceFixture,
      memberProjects: [projectFixture],
      branchName: "feature/failure",
      useExistingBranch: false,
      runTask,
      refreshDivergences: vi.fn().mockResolvedValue(undefined),
      refreshWorkspaces: vi.fn().mockResolvedValue(undefined),
      refreshPortAllocations: vi.fn(),
    })).resolves.toBeUndefined();

    await Promise.resolve();
    expect(consoleError).toHaveBeenCalledWith("Create workspace divergences task failed:", expect.any(Error));
  });
});
