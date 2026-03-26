import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../lib/cn.pure";

export interface ModalBodyProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  scrollable?: boolean;
}

function ModalBody({
  children,
  scrollable = false,
  className,
  ...rest
}: ModalBodyProps) {
  return (
    <div
      className={cn(
        "space-y-4 px-4 py-4",
        scrollable ? "min-h-0 overflow-y-auto" : undefined,
        className
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

export default ModalBody;
