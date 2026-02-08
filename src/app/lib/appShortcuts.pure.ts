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
  sessionCount: number;
  hasCreateDivergenceModalOpen: boolean;
  canResolveProjectForNewDivergence: boolean;
}

export type AppShortcutAction =
  | { type: "toggle_quick_switcher" }
  | { type: "toggle_file_quick_switcher" }
  | { type: "toggle_settings" }
  | { type: "toggle_right_panel" }
  | { type: "toggle_sidebar" }
  | { type: "close_overlays" }
  | { type: "close_active_session" }
  | { type: "new_divergence" }
  | { type: "split_terminal"; orientation: SplitOrientation }
  | { type: "reconnect_terminal" }
  | { type: "select_tab"; index: number }
  | { type: "select_previous_tab" }
  | { type: "select_next_tab" };

export function resolveAppShortcut(
  event: AppShortcutEvent,
  context: AppShortcutContext
): AppShortcutAction | null {
  if (event.defaultPrevented || context.isFromEditor) {
    return null;
  }

  const isMeta = event.metaKey || event.ctrlKey;
  const keyLower = event.key.toLowerCase();

  if (isMeta && keyLower === "k") {
    return { type: "toggle_quick_switcher" };
  }

  if (isMeta && event.shiftKey && keyLower === "o") {
    if (!context.hasActiveSession) {
      return null;
    }
    return { type: "toggle_file_quick_switcher" };
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

  if (isMeta && keyLower === "w") {
    if (!context.hasActiveSession) {
      return null;
    }
    return { type: "close_active_session" };
  }

  if (isMeta && keyLower === "t") {
    if (context.hasCreateDivergenceModalOpen || !context.canResolveProjectForNewDivergence) {
      return null;
    }
    return { type: "new_divergence" };
  }

  if (isMeta && keyLower === "d") {
    if (!context.hasActiveSession) {
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
    if (index >= 0 && index < context.sessionCount) {
      return { type: "select_tab", index };
    }
    return null;
  }

  if (isMeta && event.key === "[") {
    if (!context.hasActiveSession || context.sessionCount <= 1) {
      return null;
    }
    return { type: "select_previous_tab" };
  }

  if (isMeta && event.key === "]") {
    if (!context.hasActiveSession || context.sessionCount <= 1) {
      return null;
    }
    return { type: "select_next_tab" };
  }

  return null;
}
