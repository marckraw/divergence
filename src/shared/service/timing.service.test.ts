import { afterEach, describe, expect, it, vi } from "vitest";
import { createDebouncedTask, createFrameTask } from "./timing.service";

const originalRequestAnimationFrame = globalThis.requestAnimationFrame;
const originalCancelAnimationFrame = globalThis.cancelAnimationFrame;

describe("timing.service", () => {
  afterEach(() => {
    vi.useRealTimers();
    globalThis.requestAnimationFrame = originalRequestAnimationFrame;
    globalThis.cancelAnimationFrame = originalCancelAnimationFrame;
  });

  it("debounces repeated schedules and flushes on demand", () => {
    vi.useFakeTimers();
    const callback = vi.fn();
    const task = createDebouncedTask(callback, 250);

    task.schedule();
    task.schedule();
    vi.advanceTimersByTime(249);
    expect(callback).not.toHaveBeenCalled();

    task.flush();
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("coalesces frame work into a single animation frame", () => {
    const callback = vi.fn();
    const scheduledCallbacks: FrameRequestCallback[] = [];

    globalThis.requestAnimationFrame = ((frameCallback: FrameRequestCallback) => {
      scheduledCallbacks.push(frameCallback);
      return scheduledCallbacks.length;
    }) as typeof globalThis.requestAnimationFrame;
    globalThis.cancelAnimationFrame = vi.fn();

    const task = createFrameTask(callback);
    task.schedule();
    task.schedule();
    expect(scheduledCallbacks).toHaveLength(1);

    scheduledCallbacks[0]?.(16);
    expect(callback).toHaveBeenCalledTimes(1);
  });
});
