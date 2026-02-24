import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../lib/cn.pure";

export interface PanelHeaderProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}

function PanelHeader({ title, description, actions, className, ...rest }: PanelHeaderProps) {
  return (
    <div
      className={cn(
        "px-5 py-4 border-b border-surface flex items-center justify-between gap-4",
        className,
      )}
      {...rest}
    >
      <div>
        <h2 className="text-lg font-semibold text-text">{title}</h2>
        {description && <p className="text-xs text-subtext">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export default PanelHeader;
