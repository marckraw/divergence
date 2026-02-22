import type { HTMLAttributes, ReactNode } from "react";

export interface PanelProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  tone?: "sidebar" | "main";
}

function Panel({
  children,
  tone = "sidebar",
  className = "",
  ...props
}: PanelProps) {
  const toneClass = tone === "main" ? "bg-main" : "bg-sidebar";
  return (
    <div
      className={`rounded-md border border-surface ${toneClass} ${className.trim()}`.trim()}
      {...props}
    >
      {children}
    </div>
  );
}

export default Panel;
