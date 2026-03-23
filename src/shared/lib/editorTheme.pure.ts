import type { Extension } from "@codemirror/state";
import { css } from "@codemirror/lang-css";
import { html } from "@codemirror/lang-html";
import { javascript } from "@codemirror/lang-javascript";
import { json } from "@codemirror/lang-json";
import { markdown } from "@codemirror/lang-markdown";
import { python } from "@codemirror/lang-python";
import { rust } from "@codemirror/lang-rust";
import { yaml } from "@codemirror/lang-yaml";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { oneDark } from "@codemirror/theme-one-dark";
import { EditorView } from "@codemirror/view";
import { tags as t } from "@lezer/highlight";
import { dracula } from "@uiw/codemirror-theme-dracula";
import { githubDark, githubLight } from "@uiw/codemirror-theme-github";
import { vscodeDark, vscodeLight } from "@uiw/codemirror-theme-vscode";
import type { EditorThemeId } from "./editorThemes.pure";
import { getLanguageKind } from "./languageDetection.pure";

const divergenceDarkPalette = {
  background: "#1b1d23",
  panel: "#1f2330",
  gutter: "#191c24",
  activeLine: "#222735",
  border: "#2c3242",
  text: "#c0caf5",
  subtext: "#6b7394",
  cursor: "#7aa2f7",
  selection: "#2e3c642e",
  selectionFocused: "#33467c4a",
  searchMatch: "#ff9e6420",
  searchMatchSelected: "#ff9e6440",
  bracketMatch: "#7aa2f726",
  invalidBackground: "#f7768e22",
};

const divergenceLightPalette = {
  background: "#fbfbfc",
  panel: "#f3f4f8",
  gutter: "#f0f2f6",
  activeLine: "#eef2f9",
  border: "#d8dde8",
  text: "#2f3541",
  subtext: "#7c8395",
  cursor: "#1e66f5",
  selection: "#1e66f51f",
  selectionFocused: "#1e66f533",
  searchMatch: "#df8e1d24",
  searchMatchSelected: "#df8e1d3d",
  bracketMatch: "#1e66f51c",
  invalidBackground: "#d20f3920",
};

const syntaxTheme = HighlightStyle.define([
  { tag: [t.keyword, t.moduleKeyword, t.controlKeyword, t.definitionKeyword], color: "#bb9af7", fontWeight: "600" },
  { tag: [t.name, t.deleted, t.character, t.macroName, t.variableName, t.labelName], color: "#c0caf5" },
  { tag: t.propertyName, color: "#73daca" },
  { tag: [t.function(t.variableName), t.function(t.propertyName)], color: "#7aa2f7" },
  { tag: [t.color, t.constant(t.name), t.standard(t.name)], color: "#7dcfff" },
  { tag: [t.definition(t.name), t.separator, t.punctuation], color: "#9aa5ce" },
  { tag: [t.typeName, t.className, t.namespace], color: "#2ac3de" },
  { tag: [t.number, t.bool, t.null, t.atom, t.literal, t.unit], color: "#ff9e64" },
  { tag: [t.operator], color: "#89ddff" },
  { tag: [t.string, t.special(t.string)], color: "#9ece6a" },
  { tag: [t.regexp, t.escape, t.link], color: "#b4f9f8" },
  { tag: [t.meta, t.comment], color: "#565f89", fontStyle: "italic" },
  { tag: t.tagName, color: "#f7768e" },
  { tag: t.attributeName, color: "#bb9af7" },
  { tag: t.heading, color: "#7aa2f7", fontWeight: "600" },
  { tag: t.emphasis, fontStyle: "italic" },
  { tag: t.strong, fontWeight: "700" },
  { tag: t.strikethrough, textDecoration: "line-through" },
  { tag: t.invalid, color: "#f7768e", backgroundColor: divergenceDarkPalette.invalidBackground },
]);

const divergenceTheme = EditorView.theme(
  {
    "&": {
      height: "100%",
      backgroundColor: divergenceDarkPalette.background,
      color: divergenceDarkPalette.text,
      fontSize: "13px",
      fontFamily:
        '"SF Mono", "Fira Code", "JetBrains Mono", Menlo, Monaco, "Courier New", monospace',
    },
    ".cm-scroller": { overflow: "auto" },
    ".cm-content": { caretColor: divergenceDarkPalette.cursor },
    ".cm-cursor, .cm-dropCursor": { borderLeft: `2px solid ${divergenceDarkPalette.cursor}` },
    "&.cm-focused .cm-cursor": { borderLeftColor: divergenceDarkPalette.cursor },
    ".cm-selectionBackground": { backgroundColor: divergenceDarkPalette.selection },
    "&.cm-focused .cm-selectionBackground": { backgroundColor: divergenceDarkPalette.selectionFocused },
    ".cm-selectionLayer .cm-selectionBackground": { backgroundColor: divergenceDarkPalette.selectionFocused },
    ".cm-gutters": {
      backgroundColor: divergenceDarkPalette.gutter,
      color: divergenceDarkPalette.subtext,
      border: `1px solid ${divergenceDarkPalette.border}`,
      borderTop: "none",
      borderBottom: "none",
      borderLeft: "none",
    },
    ".cm-lineNumbers": { color: divergenceDarkPalette.subtext },
    ".cm-activeLine": { backgroundColor: divergenceDarkPalette.activeLine },
    ".cm-activeLineGutter": {
      backgroundColor: divergenceDarkPalette.activeLine,
      color: divergenceDarkPalette.text,
    },
    ".cm-matchingBracket": {
      backgroundColor: divergenceDarkPalette.bracketMatch,
      color: divergenceDarkPalette.text,
    },
    ".cm-nonmatchingBracket": {
      backgroundColor: divergenceDarkPalette.invalidBackground,
      color: "#f7768e",
    },
    ".cm-searchMatch": {
      backgroundColor: divergenceDarkPalette.searchMatch,
      outline: `1px solid ${divergenceDarkPalette.searchMatchSelected}`,
    },
    ".cm-searchMatch.cm-searchMatch-selected": {
      backgroundColor: divergenceDarkPalette.searchMatchSelected,
    },
    ".cm-selectionMatch": {
      backgroundColor: "#73daca1c",
      outline: "1px solid #73daca30",
    },
    ".cm-panels": {
      backgroundColor: divergenceDarkPalette.panel,
      color: divergenceDarkPalette.text,
    },
    ".cm-panels-top": {
      borderBottom: `1px solid ${divergenceDarkPalette.border}`,
    },
    ".cm-panels-bottom": {
      borderTop: `1px solid ${divergenceDarkPalette.border}`,
    },
    ".cm-search": {
      padding: "8px 10px",
      gap: "8px",
    },
    ".cm-search label": {
      color: divergenceDarkPalette.subtext,
    },
    ".cm-search input, .cm-search button": {
      backgroundColor: divergenceDarkPalette.gutter,
      color: divergenceDarkPalette.text,
      border: `1px solid ${divergenceDarkPalette.border}`,
      borderRadius: "8px",
    },
    ".cm-search button": {
      padding: "2px 10px",
    },
    ".cm-foldPlaceholder": {
      backgroundColor: divergenceDarkPalette.panel,
      border: `1px solid ${divergenceDarkPalette.border}`,
      color: divergenceDarkPalette.subtext,
      borderRadius: "6px",
    },
  },
  { dark: true },
);

const divergenceHighlight = syntaxHighlighting(syntaxTheme, { fallback: true });

const syntaxThemeLight = HighlightStyle.define([
  { tag: t.keyword, color: "#8839ef", fontWeight: "600" },
  { tag: [t.name, t.deleted, t.character, t.macroName, t.variableName], color: "#2f3541" },
  { tag: t.propertyName, color: "#1e66f5" },
  { tag: [t.function(t.variableName), t.labelName], color: "#df8e1d" },
  { tag: [t.color, t.constant(t.name), t.standard(t.name)], color: "#ea76cb" },
  { tag: [t.definition(t.name), t.separator, t.punctuation], color: "#7c8395" },
  { tag: [t.typeName, t.className], color: "#179299" },
  { tag: [t.number, t.bool, t.null, t.atom, t.literal, t.unit], color: "#fe640b" },
  { tag: [t.operator], color: "#209fb5" },
  { tag: [t.string, t.special(t.string)], color: "#40a02b" },
  { tag: [t.regexp, t.escape, t.link], color: "#209fb5" },
  { tag: [t.meta, t.comment], color: "#8c8fa1", fontStyle: "italic" },
  { tag: t.tagName, color: "#d20f39" },
  { tag: t.attributeName, color: "#df8e1d" },
  { tag: t.heading, color: "#1e66f5", fontWeight: "600" },
  { tag: t.emphasis, fontStyle: "italic" },
  { tag: t.strong, fontWeight: "700" },
  { tag: t.strikethrough, textDecoration: "line-through" },
  { tag: t.invalid, color: "#d20f39", backgroundColor: divergenceLightPalette.invalidBackground },
]);

const divergenceLightTheme = EditorView.theme(
  {
    "&": {
      height: "100%",
      backgroundColor: divergenceLightPalette.background,
      color: divergenceLightPalette.text,
      fontSize: "13px",
      fontFamily:
        '"SF Mono", "Fira Code", "JetBrains Mono", Menlo, Monaco, "Courier New", monospace',
    },
    ".cm-scroller": { overflow: "auto" },
    ".cm-content": { caretColor: divergenceLightPalette.cursor },
    ".cm-cursor, .cm-dropCursor": { borderLeft: `2px solid ${divergenceLightPalette.cursor}` },
    "&.cm-focused .cm-cursor": { borderLeftColor: divergenceLightPalette.cursor },
    ".cm-selectionBackground": { backgroundColor: divergenceLightPalette.selection },
    "&.cm-focused .cm-selectionBackground": { backgroundColor: divergenceLightPalette.selectionFocused },
    ".cm-selectionLayer .cm-selectionBackground": { backgroundColor: divergenceLightPalette.selectionFocused },
    ".cm-gutters": {
      backgroundColor: divergenceLightPalette.gutter,
      color: divergenceLightPalette.subtext,
      border: `1px solid ${divergenceLightPalette.border}`,
      borderTop: "none",
      borderBottom: "none",
      borderLeft: "none",
    },
    ".cm-lineNumbers": { color: divergenceLightPalette.subtext },
    ".cm-activeLine": { backgroundColor: divergenceLightPalette.activeLine },
    ".cm-activeLineGutter": {
      backgroundColor: divergenceLightPalette.activeLine,
      color: divergenceLightPalette.text,
    },
    ".cm-matchingBracket": {
      backgroundColor: divergenceLightPalette.bracketMatch,
      color: divergenceLightPalette.text,
    },
    ".cm-nonmatchingBracket": {
      backgroundColor: divergenceLightPalette.invalidBackground,
      color: "#d20f39",
    },
    ".cm-searchMatch": {
      backgroundColor: divergenceLightPalette.searchMatch,
      outline: `1px solid ${divergenceLightPalette.searchMatchSelected}`,
    },
    ".cm-searchMatch.cm-searchMatch-selected": {
      backgroundColor: divergenceLightPalette.searchMatchSelected,
    },
    ".cm-selectionMatch": {
      backgroundColor: "#1e66f51a",
      outline: "1px solid #1e66f52d",
    },
    ".cm-panels": {
      backgroundColor: divergenceLightPalette.panel,
      color: divergenceLightPalette.text,
    },
    ".cm-panels-top": {
      borderBottom: `1px solid ${divergenceLightPalette.border}`,
    },
    ".cm-panels-bottom": {
      borderTop: `1px solid ${divergenceLightPalette.border}`,
    },
    ".cm-search": {
      padding: "8px 10px",
      gap: "8px",
    },
    ".cm-search label": {
      color: divergenceLightPalette.subtext,
    },
    ".cm-search input, .cm-search button": {
      backgroundColor: "#ffffff",
      color: divergenceLightPalette.text,
      border: `1px solid ${divergenceLightPalette.border}`,
      borderRadius: "8px",
    },
    ".cm-search button": {
      padding: "2px 10px",
    },
    ".cm-foldPlaceholder": {
      backgroundColor: divergenceLightPalette.panel,
      border: `1px solid ${divergenceLightPalette.border}`,
      color: divergenceLightPalette.subtext,
      borderRadius: "6px",
    },
  },
  { dark: false },
);

const divergenceHighlightLight = syntaxHighlighting(syntaxThemeLight, { fallback: true });

export const themeExtensionsById: Record<EditorThemeId, Extension[]> = {
  divergence: [divergenceTheme, divergenceHighlight],
  "divergence-light": [divergenceLightTheme, divergenceHighlightLight],
  "one-dark": [oneDark],
  dracula: [dracula],
  "github-dark": [githubDark],
  "github-light": [githubLight],
  "vscode-dark": [vscodeDark],
  "vscode-light": [vscodeLight],
};

export function getLanguageExtension(filePath: string | null): Extension[] {
  const kind = getLanguageKind(filePath);
  switch (kind) {
    case "html":
      return [html()];
    case "css":
      return [css()];
    case "typescript": {
      const lower = filePath?.toLowerCase() ?? "";
      return [javascript({ typescript: true, jsx: lower.endsWith(".tsx") })];
    }
    case "javascript": {
      const lower = filePath?.toLowerCase() ?? "";
      return [javascript({ jsx: lower.endsWith(".jsx") })];
    }
    case "markdown":
      return [markdown()];
    case "python":
      return [python()];
    case "rust":
      return [rust()];
    case "json":
      return [json()];
    case "yaml":
      return [yaml()];
    case "unknown":
    default:
      return [];
  }
}
