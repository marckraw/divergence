import type { HTMLAttributes } from "react";
import { buildFormMessageClassName } from "./form.styles";

export interface FormMessageProps extends HTMLAttributes<HTMLParagraphElement> {
  tone?: "default" | "muted" | "error";
}

function FormMessage({ tone = "muted", className, children, ...props }: FormMessageProps) {
  return (
    <p className={buildFormMessageClassName(tone, className)} {...props}>
      {children}
    </p>
  );
}

export default FormMessage;
