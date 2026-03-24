import { describe, expect, it } from "vitest";
import {
  FAST_EASE_OUT,
  OVERLAY_FADE,
  SOFT_SPRING,
  getCollapseVariants,
  getContentSwapVariants,
  getPopVariants,
  getSlideInRightVariants,
  getSlideUpVariants,
} from "./motion.pure";

describe("motion constants", () => {
  it("exposes stable spring and ease presets", () => {
    expect(SOFT_SPRING).toMatchObject({
      type: "spring",
      stiffness: 260,
      damping: 30,
      mass: 0.9,
    });
    expect(FAST_EASE_OUT).toMatchObject({
      duration: 0.15,
      ease: "easeOut",
    });
  });

  it("defines the overlay fade lifecycle", () => {
    expect(OVERLAY_FADE).toEqual({
      hidden: { opacity: 0, pointerEvents: "none" },
      visible: { opacity: 1, pointerEvents: "auto" },
      exit: { opacity: 0, pointerEvents: "none" },
    });
  });
});

describe("motion variants", () => {
  it("builds pop variants for reduced and regular motion", () => {
    const regular = getPopVariants(false, 12, 0.98);
    expect(regular).toMatchObject({
      hidden: { opacity: 0, y: 12, scale: 0.98 },
      visible: { opacity: 1, y: 0, scale: 1 },
      exit: { opacity: 0, scale: 0.98 },
    });
    expect((regular.exit as { y: number }).y).toBeCloseTo(7.2);
    expect(getPopVariants(true, 12, 0.98)).toMatchObject({
      hidden: { y: 0, scale: 1 },
      exit: { y: 0, scale: 1 },
    });
  });

  it("builds slide variants", () => {
    expect(getSlideUpVariants(false)).toMatchObject({
      hidden: { y: "100%" },
      visible: { y: 0 },
      exit: { y: "100%" },
    });
    expect(getSlideInRightVariants(true, 40)).toMatchObject({
      hidden: { x: 0 },
      visible: { x: 0 },
      exit: { x: 0 },
    });
  });

  it("builds content-swap and collapse variants", () => {
    expect(getContentSwapVariants(false)).toMatchObject({
      hidden: { y: 6 },
      visible: { y: 0 },
      exit: { y: -6 },
    });
    expect(getCollapseVariants(false)).toMatchObject({
      hidden: { height: 0, opacity: 0 },
      visible: { height: "auto", opacity: 1 },
      exit: { height: 0, opacity: 0 },
    });
    expect(getCollapseVariants(true)).toMatchObject({
      hidden: { height: "auto", opacity: 0 },
      visible: { height: "auto", opacity: 1 },
      exit: { height: "auto", opacity: 0 },
    });
  });
});
