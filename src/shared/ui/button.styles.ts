import { cva, type VariantProps } from "class-variance-authority";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "subtle";
export type ButtonSize = "xs" | "sm" | "md";

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-foreground hover:bg-primary/80",
        secondary: "border border-surface text-text hover:bg-surface",
        ghost: "text-subtext hover:text-text hover:bg-surface/40",
        danger: "border border-red/30 text-red hover:bg-red/10",
        subtle: "border border-surface text-subtext hover:text-text hover:bg-surface/50",
      },
      size: {
        xs: "px-2 py-1 text-xs",
        sm: "px-3 py-1.5 text-xs",
        md: "px-4 py-2 text-sm",
      },
      iconOnly: {
        true: "",
        false: "",
      },
    },
    compoundVariants: [
      { iconOnly: true, size: "xs", className: "h-6 w-6 px-0 py-0" },
      { iconOnly: true, size: "sm", className: "h-7 w-7 px-0 py-0" },
      { iconOnly: true, size: "md", className: "h-8 w-8 px-0 py-0" },
    ],
    defaultVariants: {
      variant: "secondary",
      size: "sm",
      iconOnly: false,
    },
  },
);

export type ButtonVariantProps = VariantProps<typeof buttonVariants>;
