import type { HTMLAttributes } from "react";
import { cn } from "../lib/cn.pure";

export interface ProgressBarProps extends HTMLAttributes<HTMLDivElement> {
  value: number;
  max?: number;
  barClassName?: string;
}

function ProgressBar({
  value,
  max = 100,
  barClassName,
  className,
  ...rest
}: ProgressBarProps) {
  const percent = max > 0 ? Math.min(Math.round((value / max) * 100), 100) : 0;

  return (
    <div
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      className={cn("h-1.5 rounded-full bg-surface overflow-hidden", className)}
      {...rest}
    >
      <div
        className={cn("h-full rounded-full bg-primary transition-all", barClassName)}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

export default ProgressBar;
