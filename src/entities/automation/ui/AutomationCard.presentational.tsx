import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../../../shared/lib/cn.pure";

export interface AutomationCardProps extends HTMLAttributes<HTMLDivElement> {
  name: ReactNode;
  metadata: ReactNode;
  status: ReactNode;
  actions: ReactNode;
}

function AutomationCard({
  name,
  metadata,
  status,
  actions,
  className,
  ...rest
}: AutomationCardProps) {
  return (
    <div
      className={cn("rounded-md border border-surface p-3", className)}
      {...rest}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {name}
          {metadata}
        </div>
        <div className="text-xs text-subtext">{status}</div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">{actions}</div>
    </div>
  );
}

export default AutomationCard;
