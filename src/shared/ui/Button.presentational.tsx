import type { ButtonHTMLAttributes, ReactNode } from "react";
import { buildButtonClassName, type ButtonSize, type ButtonVariant } from "./button.styles";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  iconOnly?: boolean;
}

function Button({
  children,
  variant = "secondary",
  size = "sm",
  iconOnly = false,
  className,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buildButtonClassName({
        variant,
        size,
        iconOnly,
        className,
      })}
      {...props}
    >
      {children}
    </button>
  );
}

export default Button;
