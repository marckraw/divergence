import type { ButtonHTMLAttributes, ReactNode } from "react";
import Button from "./Button.presentational";

interface MenuButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  tone?: "default" | "danger";
}

function MenuButton({
  children,
  tone = "default",
  className = "",
  type = "button",
  ...props
}: MenuButtonProps) {
  const toneClass = tone === "danger" ? "text-red" : "text-text";
  return (
    <Button
      type={type}
      variant="ghost"
      size="md"
      className={`w-full justify-start px-4 py-2 text-left text-sm ${toneClass} hover:bg-sidebar disabled:opacity-60 disabled:cursor-default ${className.trim()}`.trim()}
      {...props}
    >
      {children}
    </Button>
  );
}

export default MenuButton;
