import type { ReactNode } from "react";

export interface SectionHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

function SectionHeader({
  title,
  description,
  actions,
  className = "",
}: SectionHeaderProps) {
  return (
    <div className={`flex items-start justify-between gap-4 ${className.trim()}`.trim()}>
      <div>
        <h2 className="text-lg font-semibold text-text">{title}</h2>
        {description && (
          <p className="text-xs text-subtext mt-1">{description}</p>
        )}
      </div>
      {actions}
    </div>
  );
}

export default SectionHeader;
