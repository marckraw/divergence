import { afterEach, describe, expect, it, vi } from "vitest";

const { mockReadDir, mockReadTextFile, mockRemove, mockWriteTextFile } = vi.hoisted(() => ({
  mockReadDir: vi.fn(),
  mockReadTextFile: vi.fn(),
  mockRemove: vi.fn(),
  mockWriteTextFile: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-fs", () => ({
  readDir: mockReadDir,
  readTextFile: mockReadTextFile,
  remove: mockRemove,
  writeTextFile: mockWriteTextFile,
}));

import { readTextFileWithTimeout } from "./fs.api";

describe("fs.api", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("returns file contents when the read completes in time", async () => {
    mockReadTextFile.mockResolvedValue("hello world");

    await expect(readTextFileWithTimeout("/tmp/example.txt", 100)).resolves.toBe("hello world");
    expect(mockReadTextFile).toHaveBeenCalledWith("/tmp/example.txt");
  });

  it("rejects with a timeout error when the read never resolves", async () => {
    vi.useFakeTimers();
    mockReadTextFile.mockImplementation(() => new Promise<string>(() => {}));

    const pendingRead = readTextFileWithTimeout("/tmp/example.txt", 100);

    await vi.advanceTimersByTimeAsync(100);

    await expect(pendingRead).rejects.toThrow("Timed out reading file after 100ms.");
  });
});
