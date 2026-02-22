const FLOAT_EPSILON = 0.00001;

export const MIN_SPLIT_PANE_SIZE_RATIO = 0.12;

function isFinitePositive(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function buildEqualSplitPaneSizes(paneCount: number): number[] {
  if (!Number.isInteger(paneCount) || paneCount <= 0) {
    return [];
  }
  return Array.from({ length: paneCount }, () => 1 / paneCount);
}

export function normalizeSplitPaneSizes(
  paneCount: number,
  paneSizes?: number[] | null,
): number[] {
  if (!Number.isInteger(paneCount) || paneCount <= 0) {
    return [];
  }
  if (!paneSizes || paneSizes.length !== paneCount) {
    return buildEqualSplitPaneSizes(paneCount);
  }

  const sanitized = paneSizes.map((size) => (isFinitePositive(size) ? size : 0));
  const total = sanitized.reduce((sum, size) => sum + size, 0);
  if (total <= FLOAT_EPSILON) {
    return buildEqualSplitPaneSizes(paneCount);
  }

  return sanitized.map((size) => size / total);
}

export function areSplitPaneSizesEqual(
  left: number[] | null | undefined,
  right: number[] | null | undefined,
  epsilon = 0.001,
): boolean {
  if (!left || !right || left.length !== right.length) {
    return false;
  }
  for (let index = 0; index < left.length; index += 1) {
    if (Math.abs(left[index] - right[index]) > epsilon) {
      return false;
    }
  }
  return true;
}

export function resizeSplitPaneSizes(
  paneSizes: number[],
  dividerIndex: number,
  deltaRatio: number,
  minPaneSizeRatio = MIN_SPLIT_PANE_SIZE_RATIO,
): number[] {
  const normalized = normalizeSplitPaneSizes(paneSizes.length, paneSizes);
  if (
    normalized.length <= 1
    || dividerIndex < 0
    || dividerIndex >= normalized.length - 1
    || !Number.isFinite(deltaRatio)
    || Math.abs(deltaRatio) <= FLOAT_EPSILON
  ) {
    return normalized;
  }

  const minRatio = clamp(minPaneSizeRatio, 0, 0.49);
  const leftSize = normalized[dividerIndex];
  const rightSize = normalized[dividerIndex + 1];
  const minDelta = Math.min(0, -(leftSize - minRatio));
  const maxDelta = Math.max(0, rightSize - minRatio);
  const clampedDelta = clamp(deltaRatio, minDelta, maxDelta);
  if (Math.abs(clampedDelta) <= FLOAT_EPSILON) {
    return normalized;
  }

  const next = [...normalized];
  next[dividerIndex] = leftSize + clampedDelta;
  next[dividerIndex + 1] = rightSize - clampedDelta;
  return normalizeSplitPaneSizes(next.length, next);
}
