import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../lib/cn.pure";

export interface ErrorBannerProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

function ErrorBanner({ children, className, ...rest }: ErrorBannerProps) {
  return (
    <div
      role="alert"
      className={cn(
        "px-3 py-2 rounded border border-red/30 bg-red/10 text-xs text-red",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

export default ErrorBanner;
