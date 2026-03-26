import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../lib/cn.pure";

export interface PanelToolbarProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

function PanelToolbar({ children, className, ...rest }: PanelToolbarProps) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 border-b border-surface px-5 py-3",
        className
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

export default PanelToolbar;
