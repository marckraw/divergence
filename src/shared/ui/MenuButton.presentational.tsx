import type { ButtonHTMLAttributes, ReactNode } from "react";

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
  const normalizedClassName = className.trim();

  return (
    <button
      type={type}
      className={`w-full px-4 py-2 text-sm text-left ${toneClass} hover:bg-sidebar transition-colors disabled:opacity-60 disabled:cursor-default ${normalizedClassName}`.trim()}
      {...props}
    >
      {children}
    </button>
  );
}

export default MenuButton;

