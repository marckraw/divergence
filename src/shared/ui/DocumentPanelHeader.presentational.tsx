import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../lib/cn.pure";

export interface DocumentPanelHeaderProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  eyebrow?: ReactNode;
  title: ReactNode;
  titleSuffix?: ReactNode;
  actions?: ReactNode;
}

function DocumentPanelHeader({
  eyebrow,
  title,
  titleSuffix,
  actions,
  className,
  ...rest
}: DocumentPanelHeaderProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 border-b border-surface px-4 py-2",
        className
      )}
      {...rest}
    >
      <div className="min-w-0">
        {eyebrow ? <p className="text-xs text-subtext/70">{eyebrow}</p> : null}
        <p className="truncate text-sm text-text">
          {title}
          {titleSuffix}
        </p>
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export default DocumentPanelHeader;
