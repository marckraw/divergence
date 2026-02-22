import type { ButtonHTMLAttributes, ReactNode } from "react";
import Button from "./Button.presentational";

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
  return (
    <Button
      type={type}
      variant="subtle"
      size={iconOnly ? "md" : "xs"}
      iconOnly={iconOnly}
      className={`text-subtext hover:text-text disabled:opacity-40 disabled:cursor-default ${className.trim()}`.trim()}
      {...props}
    >
      {children}
    </Button>
  );
}

export default ToolbarButton;
