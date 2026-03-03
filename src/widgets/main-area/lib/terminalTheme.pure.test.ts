import { describe, it, expect } from "vitest";
import {
  TERMINAL_THEME_DARK,
  TERMINAL_THEME_LIGHT,
  getTerminalTheme,
} from "./terminalTheme.pure";

describe("terminalTheme", () => {
  it("returns dark theme for dark mode", () => {
    expect(getTerminalTheme("dark")).toBe(TERMINAL_THEME_DARK);
  });

  it("returns light theme for light mode", () => {
    expect(getTerminalTheme("light")).toBe(TERMINAL_THEME_LIGHT);
  });

  it("dark theme has expected background", () => {
    expect(TERMINAL_THEME_DARK.background).toBe("#181825");
  });

  it("light theme has expected background", () => {
    expect(TERMINAL_THEME_LIGHT.background).toBe("#f8f9fc");
  });
});
