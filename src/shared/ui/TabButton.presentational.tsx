import type { ButtonHTMLAttributes, ReactNode } from "react";

interface TabButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  active: boolean;
}

function TabButton({
  children,
  active,
  className = "",
  type = "button",
  ...props
}: TabButtonProps) {
  const stateClass = active
    ? "text-text border-b-2 border-accent"
    : "text-subtext hover:text-text";
  const normalizedClassName = className.trim();

  return (
    <button
      type={type}
      className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${stateClass} ${normalizedClassName}`.trim()}
      {...props}
    >
      {children}
    </button>
  );
}

export default TabButton;

