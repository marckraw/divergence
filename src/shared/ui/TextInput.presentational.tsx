import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "../lib/cn.pure";
import { formControlVariants, type FormControlTone } from "./form.styles";

export interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {
  tone?: FormControlTone;
  invalid?: boolean;
}

const TextInput = forwardRef<HTMLInputElement, TextInputProps>(
  ({ tone = "main", invalid = false, className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(formControlVariants({ tone, invalid }), className)}
        {...props}
      />
    );
  },
);

TextInput.displayName = "TextInput";

export default TextInput;
