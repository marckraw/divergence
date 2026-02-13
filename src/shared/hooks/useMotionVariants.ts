import { useMemo } from "react";
import { useReducedMotion } from "framer-motion";
import type { Transition, Variants } from "framer-motion";
import {
  FAST_EASE_OUT,
  SOFT_SPRING,
  getPopVariants,
  getCollapseVariants,
  getContentSwapVariants,
} from "../lib/motion";

interface MotionVariantsResult {
  shouldReduceMotion: boolean | null;
  layoutTransition: Transition;
  pop: Variants;
  collapse: Variants;
  contentSwap: Variants;
}

/**
 * Returns pre-memoized motion variants and transitions based on the user's
 * reduce-motion preference. Eliminates the repeated pattern of calling
 * useReducedMotion + useMemo across presentational components.
 */
export function useMotionVariants(popOffset = 12, popScale = 0.98): MotionVariantsResult {
  const shouldReduceMotion = useReducedMotion();

  const pop = useMemo(
    () => getPopVariants(shouldReduceMotion, popOffset, popScale),
    [shouldReduceMotion, popOffset, popScale],
  );

  const collapse = useMemo(
    () => getCollapseVariants(shouldReduceMotion),
    [shouldReduceMotion],
  );

  const contentSwap = useMemo(
    () => getContentSwapVariants(shouldReduceMotion),
    [shouldReduceMotion],
  );

  const layoutTransition = shouldReduceMotion ? FAST_EASE_OUT : SOFT_SPRING;

  return {
    shouldReduceMotion,
    layoutTransition,
    pop,
    collapse,
    contentSwap,
  };
}
