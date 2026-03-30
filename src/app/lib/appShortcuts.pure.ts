import type { SplitOrientation } from "../../entities";

export interface AppShortcutEvent {
  defaultPrevented: boolean;
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
}

export interface AppShortcutContext {
  isFromEditor: boolean;
  hasActiveSession: boolean;
  activeSessionId: string | null;
  hasOpenStage: boolean;
  tabCount: number;
}

export type AppShortcutAction =
  | { type: "toggle_quick_switcher_reveal" }
  | { type: "toggle_file_quick_switcher" }
  | { type: "open_work_inbox" }
  | { type: "toggle_settings" }
  | { type: "toggle_right_panel" }
  | { type: "toggle_sidebar" }
  | { type: "close_overlays" }
  | { type: "close_focused_pane" }
  | { type: "new_tab" }
  | { type: "split_terminal"; orientation: SplitOrientation }
  | { type: "reconnect_terminal" }
  | { type: "select_tab"; index: number }
  | { type: "focus_next_tab" }
  | { type: "focus_previous_tab" }
  | { type: "focus_previous_pane" }
  | { type: "focus_next_pane" };

export function resolveAppShortcut(
  event: AppShortcutEvent,
  context: AppShortcutContext
): AppShortcutAction | null {
  if (event.defaultPrevented) {
    return null;
  }

  const isMeta = event.metaKey || event.ctrlKey;
  const keyLower = event.key.toLowerCase();

  if (context.isFromEditor) {
    if (!(isMeta && keyLower === "w")) {
      return null;
    }
  }

  if (isMeta && event.shiftKey && keyLower === "k") {
    return { type: "toggle_quick_switcher_reveal" };
  }

  if (isMeta && keyLower === "k") {
    return { type: "toggle_quick_switcher_reveal" };
  }

  if (isMeta && event.shiftKey && keyLower === "o") {
    if (!context.hasActiveSession) {
      return null;
    }
    return { type: "toggle_file_quick_switcher" };
  }

  if (isMeta && keyLower === "i") {
    return { type: "open_work_inbox" };
  }

  if (isMeta && event.key === ",") {
    return { type: "toggle_settings" };
  }

  if (isMeta && event.shiftKey && keyLower === "b") {
    return { type: "toggle_right_panel" };
  }

  if (isMeta && keyLower === "b") {
    return { type: "toggle_sidebar" };
  }

  if (event.key === "Escape") {
    return { type: "close_overlays" };
  }

  if (event.ctrlKey && event.key === "Tab") {
    if (context.tabCount <= 1) {
      return null;
    }

    return event.shiftKey
      ? { type: "focus_previous_tab" }
      : { type: "focus_next_tab" };
  }

  if (isMeta && keyLower === "w") {
    if (!context.hasOpenStage) {
      return null;
    }
    return { type: "close_focused_pane" };
  }

  if (isMeta && keyLower === "t") {
    return { type: "new_tab" };
  }

  if (isMeta && keyLower === "d") {
    if (!context.hasOpenStage && !context.hasActiveSession) {
      return null;
    }
    return {
      type: "split_terminal",
      orientation: event.shiftKey ? "horizontal" : "vertical",
    };
  }

  if (isMeta && event.shiftKey && keyLower === "r") {
    if (!context.hasActiveSession) {
      return null;
    }
    return { type: "reconnect_terminal" };
  }

  if (isMeta && event.key >= "1" && event.key <= "9") {
    const index = Number(event.key) - 1;
    if (index >= 0 && index < context.tabCount) {
      return { type: "select_tab", index };
    }
    return null;
  }

  if (isMeta && event.key === "[") {
    if (!context.hasOpenStage) {
      return null;
    }
    return { type: "focus_previous_pane" };
  }

  if (isMeta && event.key === "]") {
    if (!context.hasOpenStage) {
      return null;
    }
    return { type: "focus_next_pane" };
  }

  return null;
}
