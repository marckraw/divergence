import { cva, type VariantProps } from "class-variance-authority";

export const formControlVariants = cva(
  "w-full px-3 py-2 text-sm rounded focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-60 disabled:cursor-not-allowed",
  {
    variants: {
      tone: {
        main: "bg-main border border-surface text-text placeholder:text-subtext",
        surface: "bg-surface border border-surface text-text placeholder:text-subtext",
      },
      invalid: {
        true: "border-red/40 focus:ring-red/60",
        false: "",
      },
    },
    defaultVariants: {
      tone: "main",
      invalid: false,
    },
  },
);

export type FormControlTone = NonNullable<VariantProps<typeof formControlVariants>["tone"]>;

export function buildFormLabelClassName(className?: string): string {
  return ["block", "text-sm", "text-text", "mb-1", className?.trim() ?? ""].join(" ").trim();
}

export function buildFormMessageClassName(
  tone: "default" | "muted" | "error",
  className?: string,
): string {
  const toneClass = tone === "error"
    ? "text-red"
    : tone === "muted"
      ? "text-subtext"
      : "text-text";
  return ["text-xs", toneClass, className?.trim() ?? ""].join(" ").trim();
}
