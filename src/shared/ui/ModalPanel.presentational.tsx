import { useMemo } from "react";
import type { ReactNode } from "react";
import { motion, type HTMLMotionProps, useReducedMotion } from "framer-motion";
import { FAST_EASE_OUT, SOFT_SPRING, getPopVariants } from "../lib/motion.pure";
import { buildModalPanelClassName, type ModalSize, type ModalSurface } from "./modal.styles";

export interface ModalPanelProps extends Omit<HTMLMotionProps<"div">, "children"> {
  children: ReactNode;
  size?: ModalSize;
  surface?: ModalSurface;
}

function ModalPanel({
  children,
  size = "md",
  surface = "sidebar",
  className,
  ...props
}: ModalPanelProps) {
  const shouldReduceMotion = useReducedMotion();
  const panelVariants = useMemo(
    () => getPopVariants(shouldReduceMotion),
    [shouldReduceMotion],
  );
  const panelTransition = shouldReduceMotion ? FAST_EASE_OUT : SOFT_SPRING;

  return (
    <motion.div
      className={buildModalPanelClassName({
        size,
        surface,
        className,
      })}
      variants={panelVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      transition={panelTransition}
      {...props}
    >
      {children}
    </motion.div>
  );
}

export default ModalPanel;
