interface SchedulableTask {
  schedule: () => void;
  cancel: () => void;
  flush: () => void;
}

export function createDebouncedTask(callback: () => void, delayMs: number): SchedulableTask {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const cancel = () => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  const flush = () => {
    if (timeoutId === null) {
      return;
    }
    cancel();
    callback();
  };

  const schedule = () => {
    cancel();
    timeoutId = setTimeout(() => {
      timeoutId = null;
      callback();
    }, delayMs);
  };

  return {
    schedule,
    cancel,
    flush,
  };
}

export function createFrameTask(callback: () => void): SchedulableTask {
  let frameId: number | null = null;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const cancel = () => {
    if (frameId !== null && typeof globalThis.cancelAnimationFrame === "function") {
      globalThis.cancelAnimationFrame(frameId);
      frameId = null;
    }
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  const run = () => {
    frameId = null;
    timeoutId = null;
    callback();
  };

  const flush = () => {
    if (frameId === null && timeoutId === null) {
      return;
    }
    cancel();
    callback();
  };

  const schedule = () => {
    if (frameId !== null || timeoutId !== null) {
      return;
    }

    if (typeof globalThis.requestAnimationFrame === "function") {
      frameId = globalThis.requestAnimationFrame(run);
      return;
    }

    timeoutId = setTimeout(run, 16);
  };

  return {
    schedule,
    cancel,
    flush,
  };
}
