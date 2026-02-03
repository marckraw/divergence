export type EditorThemeId =
  | "divergence"
  | "one-dark"
  | "dracula"
  | "github-dark"
  | "vscode-dark";

export const EDITOR_THEME_OPTIONS: { id: EditorThemeId; label: string }[] = [
  { id: "divergence", label: "Divergence (Custom)" },
  { id: "one-dark", label: "One Dark" },
  { id: "dracula", label: "Dracula" },
  { id: "github-dark", label: "GitHub Dark" },
  { id: "vscode-dark", label: "VS Code Dark" },
];

export const DEFAULT_EDITOR_THEME: EditorThemeId = "divergence";

export function isEditorThemeId(value: unknown): value is EditorThemeId {
  return typeof value === "string" && EDITOR_THEME_OPTIONS.some(option => option.id === value);
}
