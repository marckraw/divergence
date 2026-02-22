import type { ReactNode } from "react";
import { motion, type HTMLMotionProps } from "framer-motion";
import { FAST_EASE_OUT, OVERLAY_FADE } from "../lib/motion.pure";
import { buildModalOverlayClassName } from "./modal.styles";

export interface ModalOverlayProps extends Omit<HTMLMotionProps<"div">, "children"> {
  children: ReactNode;
}

function ModalOverlay({
  children,
  className,
  ...props
}: ModalOverlayProps) {
  return (
    <motion.div
      className={buildModalOverlayClassName({ className })}
      variants={OVERLAY_FADE}
      initial="hidden"
      animate="visible"
      exit="exit"
      transition={FAST_EASE_OUT}
      {...props}
    >
      {children}
    </motion.div>
  );
}

export default ModalOverlay;
