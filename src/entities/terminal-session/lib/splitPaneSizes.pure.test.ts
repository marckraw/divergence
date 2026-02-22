import { describe, expect, it } from "vitest";
import {
  areSplitPaneSizesEqual,
  buildEqualSplitPaneSizes,
  normalizeSplitPaneSizes,
  resizeSplitPaneSizes,
} from "./splitPaneSizes.pure";

describe("split pane size utils", () => {
  it("builds equal pane sizes", () => {
    expect(buildEqualSplitPaneSizes(2)).toEqual([0.5, 0.5]);
    expect(buildEqualSplitPaneSizes(3)).toEqual([1 / 3, 1 / 3, 1 / 3]);
    expect(buildEqualSplitPaneSizes(0)).toEqual([]);
  });

  it("normalizes and falls back to equal sizes when input is invalid", () => {
    expect(normalizeSplitPaneSizes(2, [3, 1])).toEqual([0.75, 0.25]);
    expect(normalizeSplitPaneSizes(2, [0, 0])).toEqual([0.5, 0.5]);
    expect(normalizeSplitPaneSizes(2, [1])).toEqual([0.5, 0.5]);
    expect(normalizeSplitPaneSizes(3, [1, Number.NaN, 1])).toEqual([0.5, 0, 0.5]);
  });

  it("resizes adjacent panes and keeps others unchanged", () => {
    const resizedTwo = resizeSplitPaneSizes([0.5, 0.5], 0, 0.1);
    expect(resizedTwo[0]).toBeCloseTo(0.6, 5);
    expect(resizedTwo[1]).toBeCloseTo(0.4, 5);

    const resizedThree = resizeSplitPaneSizes([0.5, 0.3, 0.2], 1, -0.05);
    expect(resizedThree[0]).toBeCloseTo(0.5, 5);
    expect(resizedThree[1]).toBeCloseTo(0.25, 5);
    expect(resizedThree[2]).toBeCloseTo(0.25, 5);
  });

  it("clamps resize to keep panes above minimum size", () => {
    const resized = resizeSplitPaneSizes([0.2, 0.8], 0, -0.2, 0.15);
    expect(resized[0]).toBeCloseTo(0.15, 5);
    expect(resized[1]).toBeCloseTo(0.85, 5);
  });

  it("compares pane size arrays with epsilon tolerance", () => {
    expect(areSplitPaneSizesEqual([0.5, 0.5], [0.5004, 0.4996])).toBe(true);
    expect(areSplitPaneSizesEqual([0.5, 0.5], [0.51, 0.49])).toBe(false);
    expect(areSplitPaneSizesEqual([0.5], null)).toBe(false);
  });
});
