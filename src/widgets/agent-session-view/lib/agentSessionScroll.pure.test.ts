import { describe, expect, it } from "vitest";
import {
  getScrollDistanceFromBottom,
  isScrollNearBottom,
} from "./agentSessionScroll.pure";

describe("agentSessionScroll.pure", () => {
  it("calculates the distance from the bottom of a scroll container", () => {
    expect(getScrollDistanceFromBottom({
      scrollTop: 240,
      scrollHeight: 1000,
      clientHeight: 700,
    })).toBe(60);
  });

  it("treats scroll positions near the bottom as sticky", () => {
    expect(isScrollNearBottom({
      scrollTop: 262,
      scrollHeight: 1000,
      clientHeight: 700,
    })).toBe(true);
  });

  it("treats scroll positions above the threshold as detached", () => {
    expect(isScrollNearBottom({
      scrollTop: 200,
      scrollHeight: 1000,
      clientHeight: 700,
    })).toBe(false);
  });
});
