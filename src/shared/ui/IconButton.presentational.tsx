import type { ButtonHTMLAttributes, ReactNode } from "react";
import Button, { type ButtonProps } from "./Button.presentational";

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  icon: ReactNode;
  label: string;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
}

function IconButton({
  icon,
  label,
  title,
  variant = "subtle",
  size = "sm",
  ...props
}: IconButtonProps) {
  return (
    <Button
      {...props}
      iconOnly
      variant={variant}
      size={size}
      aria-label={label}
      title={title ?? label}
    >
      {icon}
    </Button>
  );
}

export default IconButton;
