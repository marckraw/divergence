const FORM_CONTROL_BASE_CLASS = [
  "w-full",
  "px-3",
  "py-2",
  "text-sm",
  "rounded",
  "focus:outline-none",
  "focus:ring-1",
  "focus:ring-accent",
  "disabled:opacity-60",
  "disabled:cursor-not-allowed",
].join(" ");

const FORM_CONTROL_TONE_CLASS_MAP = {
  main: "bg-main border border-surface text-text placeholder:text-subtext",
  surface: "bg-surface border border-surface text-text placeholder:text-subtext",
} as const;

export type FormControlTone = keyof typeof FORM_CONTROL_TONE_CLASS_MAP;

export interface BuildFormControlClassNameInput {
  tone?: FormControlTone;
  invalid?: boolean;
  className?: string;
}

export function buildFormControlClassName({
  tone = "main",
  invalid = false,
  className,
}: BuildFormControlClassNameInput): string {
  return [
    FORM_CONTROL_BASE_CLASS,
    FORM_CONTROL_TONE_CLASS_MAP[tone],
    invalid ? "border-red/40 focus:ring-red/60" : "",
    className?.trim() ?? "",
  ].join(" ").trim();
}

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
