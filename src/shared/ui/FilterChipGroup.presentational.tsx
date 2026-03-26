import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../lib/cn.pure";
import Button from "./Button.presentational";

export interface FilterChipItem<T extends string> {
  id: T;
  label: ReactNode;
  tone?: "default" | "danger";
}

export interface FilterChipGroupProps<T extends string>
  extends Omit<HTMLAttributes<HTMLDivElement>, "onChange"> {
  items: FilterChipItem<T>[];
  value: T;
  onChange: (value: T) => void;
}

function FilterChipGroup<T extends string>({
  items,
  value,
  onChange,
  className,
  ...rest
}: FilterChipGroupProps<T>) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)} {...rest}>
      {items.map((item) => {
        const isActive = value === item.id;
        const activeClassName =
          item.tone === "danger"
            ? "border-red/50 bg-red/10 text-red"
            : "border-accent bg-accent/15 text-accent";
        return (
          <Button
            key={item.id}
            type="button"
            onClick={() => onChange(item.id)}
            variant={isActive ? "primary" : "subtle"}
            size="xs"
            className={cn(
              "rounded border px-2.5 py-1 text-xs",
              isActive
                ? activeClassName
                : "border-surface text-subtext hover:bg-surface hover:text-text"
            )}
          >
            {item.label}
          </Button>
        );
      })}
    </div>
  );
}

export default FilterChipGroup;
