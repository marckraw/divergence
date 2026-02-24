import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "../lib/cn.pure";
import { buttonVariants, type ButtonSize, type ButtonVariant } from "./button.styles";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  iconOnly?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      variant = "secondary",
      size = "sm",
      iconOnly = false,
      className,
      type = "button",
      ...props
    },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(buttonVariants({ variant, size, iconOnly }), className)}
        {...props}
      >
        {children}
      </button>
    );
  },
);

Button.displayName = "Button";

export default Button;
