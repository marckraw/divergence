import { forwardRef, type TextareaHTMLAttributes } from "react";
import { cn } from "../lib/cn.pure";
import { formControlVariants, type FormControlTone } from "./form.styles";

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  tone?: FormControlTone;
  invalid?: boolean;
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ tone = "main", invalid = false, className, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={cn(formControlVariants({ tone, invalid }), className)}
        {...props}
      />
    );
  },
);

Textarea.displayName = "Textarea";

export default Textarea;
