import type { InputHTMLAttributes } from "react";
import { buildFormControlClassName, type FormControlTone } from "./form.styles";

export interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {
  tone?: FormControlTone;
  invalid?: boolean;
}

function TextInput({
  tone = "main",
  invalid = false,
  className,
  ...props
}: TextInputProps) {
  return (
    <input
      className={buildFormControlClassName({
        tone,
        invalid,
        className,
      })}
      {...props}
    />
  );
}

export default TextInput;
