import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../lib/cn.pure";

export interface ModalFooterProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

function ModalFooter({ children, className, ...rest }: ModalFooterProps) {
  return (
    <div
      className={cn(
        "px-4 py-3 border-t border-surface flex items-center justify-end gap-2",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

export default ModalFooter;
