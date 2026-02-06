import type { Transition, Variants } from "framer-motion";

export const SOFT_SPRING: Transition = {
  type: "spring",
  stiffness: 260,
  damping: 30,
  mass: 0.9,
};

export const FAST_EASE_OUT: Transition = {
  duration: 0.15,
  ease: "easeOut",
};

export const OVERLAY_FADE: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
};

export const getPopVariants = (reduced: boolean | null, offset = 12, scale = 0.98): Variants => ({
  hidden: {
    opacity: 0,
    y: reduced ? 0 : offset,
    scale: reduced ? 1 : scale,
  },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
  },
  exit: {
    opacity: 0,
    y: reduced ? 0 : offset * 0.6,
    scale: reduced ? 1 : scale,
  },
});

export const getSlideUpVariants = (reduced: boolean | null): Variants => ({
  hidden: {
    opacity: 0,
    y: reduced ? 0 : "100%",
  },
  visible: {
    opacity: 1,
    y: 0,
  },
  exit: {
    opacity: 0,
    y: reduced ? 0 : "100%",
  },
});

export const getSlideInRightVariants = (reduced: boolean | null, offset = 40): Variants => ({
  hidden: {
    opacity: 0,
    x: reduced ? 0 : offset,
  },
  visible: {
    opacity: 1,
    x: 0,
  },
  exit: {
    opacity: 0,
    x: reduced ? 0 : offset,
  },
});

export const getContentSwapVariants = (reduced: boolean | null): Variants => ({
  hidden: {
    opacity: 0,
    y: reduced ? 0 : 6,
  },
  visible: {
    opacity: 1,
    y: 0,
  },
  exit: {
    opacity: 0,
    y: reduced ? 0 : -6,
  },
});

export const getCollapseVariants = (reduced: boolean | null): Variants => ({
  hidden: {
    height: reduced ? "auto" : 0,
    opacity: 0,
  },
  visible: {
    height: "auto",
    opacity: 1,
  },
  exit: {
    height: reduced ? "auto" : 0,
    opacity: 0,
  },
});
