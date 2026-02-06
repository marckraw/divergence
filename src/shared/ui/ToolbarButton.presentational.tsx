import type { ButtonHTMLAttributes, ReactNode } from "react";

interface ToolbarButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  iconOnly?: boolean;
}

function ToolbarButton({
  children,
  iconOnly = false,
  className = "",
  type = "button",
  ...props
}: ToolbarButtonProps) {
  const sizeClass = iconOnly
    ? "flex items-center justify-center w-8 h-8"
    : "text-xs px-2 py-1";

  const normalizedClassName = className.trim();

  return (
    <button
      type={type}
      className={`${sizeClass} rounded border border-surface text-subtext hover:text-text hover:bg-surface/50 transition-colors disabled:opacity-40 disabled:cursor-default ${normalizedClassName}`.trim()}
      {...props}
    >
      {children}
    </button>
  );
}

export default ToolbarButton;

