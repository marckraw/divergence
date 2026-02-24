import type { ReactNode } from "react";
import { cn } from "../lib/cn.pure";
import Label from "./Label.presentational";

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
        <Label htmlFor={htmlFor} className={cn(labelClassName)}>
          {label}
        </Label>
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
