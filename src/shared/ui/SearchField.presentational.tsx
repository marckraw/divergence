import type { InputHTMLAttributes } from "react";
import { cn } from "../lib/cn.pure";
import TextInput from "./TextInput.presentational";
import IconButton from "./IconButton.presentational";

export interface SearchFieldProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> {
  value: string;
  onChange: (value: string) => void;
  onClear?: () => void;
  wrapperClassName?: string;
  inputClassName?: string;
}

function SearchField({
  value,
  onChange,
  onClear,
  className,
  wrapperClassName,
  inputClassName,
  placeholder = "Search",
  ...rest
}: SearchFieldProps) {
  const canClear = value.trim().length > 0 && onClear;

  return (
    <div className={cn("relative flex-1 min-w-0", wrapperClassName)}>
      <svg
        className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-subtext/70"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        aria-hidden="true"
      >
        <circle cx="11" cy="11" r="7" strokeWidth="2" />
        <path strokeWidth="2" strokeLinecap="round" d="m20 20-3.5-3.5" />
      </svg>
      <TextInput
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className={cn("pl-9 pr-9", inputClassName, className)}
        {...rest}
      />
      {canClear ? (
        <IconButton
          type="button"
          variant="ghost"
          size="xs"
          icon="x"
          label="Clear search"
          className="absolute right-1.5 top-1/2 -translate-y-1/2 text-subtext hover:text-text"
          onClick={onClear}
        />
      ) : null}
    </div>
  );
}

export default SearchField;
