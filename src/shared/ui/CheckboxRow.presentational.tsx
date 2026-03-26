import type { InputHTMLAttributes, ReactNode } from "react";
import { cn } from "../lib/cn.pure";

export interface CheckboxRowProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "onChange"> {
  label: ReactNode;
  description?: ReactNode;
  onChange: (checked: boolean) => void;
}

function CheckboxRow({
  label,
  description,
  checked,
  disabled,
  onChange,
  className,
  ...rest
}: CheckboxRowProps) {
  return (
    <label className={cn("flex items-start gap-3 cursor-pointer", disabled ? "opacity-60" : undefined, className)}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1 rounded border-surface text-accent focus:ring-accent"
        {...rest}
      />
      <div>
        <p className="text-sm text-text">{label}</p>
        {description ? <p className="mt-1 text-xs text-subtext">{description}</p> : null}
      </div>
    </label>
  );
}

export default CheckboxRow;
