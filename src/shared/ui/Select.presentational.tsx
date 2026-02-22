import type { SelectHTMLAttributes } from "react";
import { buildFormControlClassName, type FormControlTone } from "./form.styles";

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  tone?: FormControlTone;
  invalid?: boolean;
}

function Select({
  tone = "main",
  invalid = false,
  className,
  ...props
}: SelectProps) {
  return (
    <select
      className={buildFormControlClassName({
        tone,
        invalid,
        className,
      })}
      {...props}
    />
  );
}

export default Select;
