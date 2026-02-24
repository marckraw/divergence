import { cn } from "../lib/cn.pure";
import Button from "./Button.presentational";

export interface SegmentedControlItem<T extends string> {
  id: T;
  label: React.ReactNode;
}

export interface SegmentedControlProps<T extends string> {
  items: SegmentedControlItem<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

function SegmentedControl<T extends string>({
  items,
  value,
  onChange,
  className,
}: SegmentedControlProps<T>) {
  return (
    <div className={cn("inline-flex rounded-md bg-main p-1", className)}>
      {items.map((item) => (
        <Button
          key={item.id}
          type="button"
          onClick={() => onChange(item.id)}
          variant={value === item.id ? "primary" : "ghost"}
          size="xs"
          className={cn(
            "px-2 py-1 text-xs rounded",
            value === item.id
              ? "bg-primary text-primary-foreground"
              : "text-subtext hover:text-text",
          )}
        >
          {item.label}
        </Button>
      ))}
    </div>
  );
}

export default SegmentedControl;
