import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../lib/cn.pure";

export interface KbdProps extends HTMLAttributes<HTMLElement> {
  children: ReactNode;
}

function Kbd({ children, className, ...rest }: KbdProps) {
  return (
    <kbd
      className={cn("px-1.5 py-0.5 bg-surface rounded text-xs", className)}
      {...rest}
    >
      {children}
    </kbd>
  );
}

export default Kbd;
