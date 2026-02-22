import type { TextareaHTMLAttributes } from "react";
import { buildFormControlClassName, type FormControlTone } from "./form.styles";

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  tone?: FormControlTone;
  invalid?: boolean;
}

function Textarea({
  tone = "main",
  invalid = false,
  className,
  ...props
}: TextareaProps) {
  return (
    <textarea
      className={buildFormControlClassName({
        tone,
        invalid,
        className,
      })}
      {...props}
    />
  );
}

export default Textarea;
