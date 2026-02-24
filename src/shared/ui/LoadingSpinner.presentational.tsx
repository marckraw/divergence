import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../lib/cn.pure";

export interface LoadingSpinnerProps extends HTMLAttributes<HTMLDivElement> {
  children?: ReactNode;
}

function LoadingSpinner({ children, className, ...rest }: LoadingSpinnerProps) {
  return (
    <div
      className={cn("flex items-center gap-2 text-xs text-subtext", className)}
      {...rest}
    >
      <span className="spinner" />
      {children}
    </div>
  );
}

export default LoadingSpinner;
