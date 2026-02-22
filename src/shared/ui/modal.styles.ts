export type ModalSize = "sm" | "md" | "lg" | "xl";
export type ModalSurface = "sidebar" | "main";

const MODAL_OVERLAY_BASE_CLASS = [
  "fixed",
  "inset-0",
  "z-50",
  "bg-black/50",
  "flex",
  "items-center",
  "justify-center",
].join(" ");

const MODAL_PANEL_BASE_CLASS = [
  "rounded-lg",
  "border",
  "border-surface",
  "shadow-xl",
].join(" ");

const MODAL_SIZE_CLASS_MAP: Record<ModalSize, string> = {
  sm: "w-full max-w-sm",
  md: "w-full max-w-md",
  lg: "w-full max-w-2xl",
  xl: "w-full max-w-4xl",
};

const MODAL_SURFACE_CLASS_MAP: Record<ModalSurface, string> = {
  sidebar: "bg-sidebar",
  main: "bg-main",
};

export interface BuildModalOverlayClassNameInput {
  className?: string;
}

export interface BuildModalPanelClassNameInput {
  size?: ModalSize;
  surface?: ModalSurface;
  className?: string;
}

export function buildModalOverlayClassName({ className }: BuildModalOverlayClassNameInput): string {
  return [
    MODAL_OVERLAY_BASE_CLASS,
    className?.trim() ?? "",
  ].join(" ").trim();
}

export function buildModalPanelClassName({
  size = "md",
  surface = "sidebar",
  className,
}: BuildModalPanelClassNameInput): string {
  return [
    MODAL_PANEL_BASE_CLASS,
    MODAL_SIZE_CLASS_MAP[size],
    MODAL_SURFACE_CLASS_MAP[surface],
    className?.trim() ?? "",
  ].join(" ").trim();
}
