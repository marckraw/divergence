export type EditorThemeMode = "dark" | "light";

export type EditorThemeId =
  | "divergence"
  | "divergence-light"
  | "one-dark"
  | "dracula"
  | "github-dark"
  | "github-light"
  | "vscode-dark"
  | "vscode-light";

export interface EditorThemeOption {
  id: EditorThemeId;
  label: string;
  mode: EditorThemeMode;
}

export const EDITOR_THEME_OPTIONS: EditorThemeOption[] = [
  { id: "divergence", label: "Divergence (Dark)", mode: "dark" },
  { id: "divergence-light", label: "Divergence (Light)", mode: "light" },
  { id: "one-dark", label: "One Dark", mode: "dark" },
  { id: "dracula", label: "Dracula", mode: "dark" },
  { id: "github-dark", label: "GitHub Dark", mode: "dark" },
  { id: "github-light", label: "GitHub Light", mode: "light" },
  { id: "vscode-dark", label: "VS Code Dark", mode: "dark" },
  { id: "vscode-light", label: "VS Code Light", mode: "light" },
];

export const EDITOR_THEME_OPTIONS_DARK = EDITOR_THEME_OPTIONS.filter(
  option => option.mode === "dark"
);
export const EDITOR_THEME_OPTIONS_LIGHT = EDITOR_THEME_OPTIONS.filter(
  option => option.mode === "light"
);

export const DEFAULT_EDITOR_THEME_DARK: EditorThemeId = "divergence";
export const DEFAULT_EDITOR_THEME_LIGHT: EditorThemeId = "github-light";
export const DEFAULT_EDITOR_THEME: EditorThemeId = DEFAULT_EDITOR_THEME_DARK;

const editorThemeById = EDITOR_THEME_OPTIONS.reduce<Record<EditorThemeId, EditorThemeOption>>(
  (acc, option) => {
    acc[option.id] = option;
    return acc;
  },
  {} as Record<EditorThemeId, EditorThemeOption>
);

export function isEditorThemeId(value: unknown): value is EditorThemeId {
  return typeof value === "string" && value in editorThemeById;
}

export function getEditorThemeMode(id: EditorThemeId): EditorThemeMode {
  return editorThemeById[id]?.mode ?? "dark";
}

export function isEditorThemeMode(id: EditorThemeId, mode: EditorThemeMode): boolean {
  return getEditorThemeMode(id) === mode;
}
