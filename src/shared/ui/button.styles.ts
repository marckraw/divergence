export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "subtle";
export type ButtonSize = "xs" | "sm" | "md";

const BUTTON_BASE_CLASS = [
  "inline-flex",
  "items-center",
  "justify-center",
  "gap-1.5",
  "rounded",
  "transition-colors",
  "disabled:opacity-50",
  "disabled:cursor-not-allowed",
].join(" ");

const BUTTON_VARIANT_CLASS_MAP: Record<ButtonVariant, string> = {
  primary: "bg-accent text-main hover:bg-accent/80",
  secondary: "border border-surface text-text hover:bg-surface",
  ghost: "text-subtext hover:text-text hover:bg-surface/40",
  danger: "border border-red/30 text-red hover:bg-red/10",
  subtle: "border border-surface text-subtext hover:text-text hover:bg-surface/50",
};

const BUTTON_SIZE_CLASS_MAP: Record<ButtonSize, string> = {
  xs: "px-2 py-1 text-xs",
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2 text-sm",
};

const BUTTON_ICON_SIZE_CLASS_MAP: Record<ButtonSize, string> = {
  xs: "h-6 w-6",
  sm: "h-7 w-7",
  md: "h-8 w-8",
};

export interface BuildButtonClassNameInput {
  variant?: ButtonVariant;
  size?: ButtonSize;
  iconOnly?: boolean;
  className?: string;
}

export function buildButtonClassName({
  variant = "secondary",
  size = "sm",
  iconOnly = false,
  className,
}: BuildButtonClassNameInput): string {
  return [
    BUTTON_BASE_CLASS,
    BUTTON_VARIANT_CLASS_MAP[variant],
    iconOnly ? BUTTON_ICON_SIZE_CLASS_MAP[size] : BUTTON_SIZE_CLASS_MAP[size],
    className?.trim() ?? "",
  ].join(" ").trim();
}
