import type { ITheme } from "@xterm/xterm";

export const TERMINAL_THEME_DARK: ITheme = {
  background: "#181825",
  foreground: "#cdd6f4",
  cursor: "#f5e0dc",
  cursorAccent: "#181825",
  selectionBackground: "rgba(88, 91, 112, 0.4)",
  black: "#45475a",
  red: "#f38ba8",
  green: "#a6e3a1",
  yellow: "#f9e2af",
  blue: "#89b4fa",
  magenta: "#cba6f7",
  cyan: "#94e2d5",
  white: "#bac2de",
  brightBlack: "#585b70",
  brightRed: "#f38ba8",
  brightGreen: "#a6e3a1",
  brightYellow: "#f9e2af",
  brightBlue: "#89b4fa",
  brightMagenta: "#cba6f7",
  brightCyan: "#94e2d5",
  brightWhite: "#a6adc8",
};

export const TERMINAL_THEME_LIGHT: ITheme = {
  background: "#f8f9fc",
  foreground: "#4c4f69",
  cursor: "#2d6cdf",
  cursorAccent: "#f8f9fc",
  selectionBackground: "rgba(45, 108, 223, 0.18)",
  black: "#5c5f77",
  red: "#d20f39",
  green: "#40a02b",
  yellow: "#df8e1d",
  blue: "#1e66f5",
  magenta: "#8839ef",
  cyan: "#179299",
  white: "#bcc0cc",
  brightBlack: "#6c6f85",
  brightRed: "#d20f39",
  brightGreen: "#40a02b",
  brightYellow: "#df8e1d",
  brightBlue: "#1e66f5",
  brightMagenta: "#8839ef",
  brightCyan: "#179299",
  brightWhite: "#4c4f69",
};

export function getTerminalTheme(mode: "dark" | "light"): ITheme {
  return mode === "light" ? TERMINAL_THEME_LIGHT : TERMINAL_THEME_DARK;
}
