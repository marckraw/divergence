import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../lib/cn.pure";

export interface EmptyStateProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  bordered?: boolean;
}

function EmptyState({ children, bordered, className, ...rest }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "px-3 py-8 text-center text-sm text-subtext",
        bordered && "rounded-md border border-surface",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

export default EmptyState;
