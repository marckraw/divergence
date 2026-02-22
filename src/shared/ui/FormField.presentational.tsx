import type { ReactNode } from "react";
import { buildFormLabelClassName } from "./form.styles";

export interface FormFieldProps {
  label?: ReactNode;
  htmlFor?: string;
  hint?: ReactNode;
  error?: ReactNode;
  labelClassName?: string;
  children: ReactNode;
}

function FormField({
  label,
  htmlFor,
  hint,
  error,
  labelClassName,
  children,
}: FormFieldProps) {
  return (
    <div>
      {label && (
        <label htmlFor={htmlFor} className={buildFormLabelClassName(labelClassName)}>
          {label}
        </label>
      )}
      {children}
      {hint && !error && (
        <p className="mt-1 text-xs text-subtext">{hint}</p>
      )}
      {error && (
        <p className="mt-1 text-xs text-red">{error}</p>
      )}
    </div>
  );
}

export default FormField;
