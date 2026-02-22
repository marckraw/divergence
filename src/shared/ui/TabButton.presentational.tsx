import type { ButtonHTMLAttributes, ReactNode } from "react";
import Button from "./Button.presentational";

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
    ? "text-text border-accent hover:bg-transparent"
    : "text-subtext border-transparent hover:text-text hover:border-surface/70 hover:bg-transparent";

  return (
    <Button
      type={type}
      variant="ghost"
      size="sm"
      className={`flex-1 rounded-none border-b-2 px-3 py-2 text-xs font-medium ${stateClass} ${className.trim()}`.trim()}
      {...props}
    >
      {children}
    </Button>
  );
}

export default TabButton;
