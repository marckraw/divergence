import type { Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { oneDark } from "@codemirror/theme-one-dark";
import { dracula } from "@uiw/codemirror-theme-dracula";
import { githubDark, githubLight } from "@uiw/codemirror-theme-github";
import { vscodeDark, vscodeLight } from "@uiw/codemirror-theme-vscode";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";
import { css } from "@codemirror/lang-css";
import { html } from "@codemirror/lang-html";
import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
import { rust } from "@codemirror/lang-rust";
import { json } from "@codemirror/lang-json";
import { markdown } from "@codemirror/lang-markdown";
import { yaml } from "@codemirror/lang-yaml";
import { getLanguageKind, type EditorThemeId } from "../../../shared";

const syntaxTheme = HighlightStyle.define([
  { tag: t.keyword, color: "#c084fc", fontWeight: "600" },
  { tag: [t.name, t.deleted, t.character, t.macroName, t.variableName], color: "#d4d4d8" },
  { tag: t.propertyName, color: "#fb923c" },
  { tag: [t.function(t.variableName), t.labelName], color: "#60a5fa" },
  { tag: [t.color, t.constant(t.name), t.standard(t.name)], color: "#c084fc" },
  { tag: [t.definition(t.name), t.separator, t.punctuation], color: "#a1a1aa" },
  { tag: [t.typeName, t.className], color: "#fb923c" },
  { tag: [t.number, t.bool, t.null, t.atom, t.literal, t.unit], color: "#facc15" },
  { tag: [t.operator], color: "#22d3ee" },
  { tag: [t.string, t.special(t.string)], color: "#4ade80" },
  { tag: [t.regexp, t.escape, t.link], color: "#22d3ee" },
  { tag: [t.meta, t.comment], color: "#71717a", fontStyle: "italic" },
  { tag: t.tagName, color: "#f87171" },
  { tag: t.attributeName, color: "#facc15" },
  { tag: t.heading, color: "#60a5fa", fontWeight: "600" },
  { tag: t.emphasis, fontStyle: "italic" },
  { tag: t.strong, fontWeight: "700" },
  { tag: t.strikethrough, textDecoration: "line-through" },
  { tag: t.invalid, color: "#f87171", backgroundColor: "#f871711a" },
]);

const divergenceTheme = EditorView.theme(
  {
    "&": {
      height: "100%",
      backgroundColor: "#09090b",
      color: "#fafafa",
      fontSize: "13px",
      fontFamily:
        '"SF Mono", "Fira Code", "JetBrains Mono", Menlo, Monaco, "Courier New", monospace',
    },
    ".cm-scroller": { overflow: "auto" },
    ".cm-content": { caretColor: "#fafafa" },
    ".cm-cursor, .cm-dropCursor": { borderLeft: "2px solid #fafafa" },
    "&.cm-focused .cm-cursor": { borderLeftColor: "#fafafa" },
    ".cm-selectionBackground": { backgroundColor: "#3f3f46" },
    "&.cm-focused .cm-selectionBackground": { backgroundColor: "#3f3f46" },
    ".cm-selectionLayer .cm-selectionBackground": { backgroundColor: "#3f3f46" },
    ".cm-gutters": {
      backgroundColor: "#18181b",
      color: "#52525b",
      border: "none",
    },
    ".cm-lineNumbers": { color: "#52525b" },
    ".cm-activeLine": { backgroundColor: "#18181b" },
    ".cm-activeLineGutter": { backgroundColor: "#18181b" },
    ".cm-matchingBracket": {
      backgroundColor: "#27272a",
      color: "#fafafa",
    },
    ".cm-nonmatchingBracket": {
      backgroundColor: "#f871711a",
      color: "#f87171",
    },
  },
  { dark: true }
);

const divergenceHighlight = syntaxHighlighting(syntaxTheme, { fallback: true });

const syntaxThemeLight = HighlightStyle.define([
  { tag: t.keyword, color: "#7c3aed", fontWeight: "600" },
  { tag: [t.name, t.deleted, t.character, t.macroName, t.variableName], color: "#1f2937" },
  { tag: t.propertyName, color: "#b45309" },
  { tag: [t.function(t.variableName), t.labelName], color: "#1d4ed8" },
  { tag: [t.color, t.constant(t.name), t.standard(t.name)], color: "#9333ea" },
  { tag: [t.definition(t.name), t.separator, t.punctuation], color: "#475569" },
  { tag: [t.typeName, t.className], color: "#c2410c" },
  { tag: [t.number, t.bool, t.null, t.atom, t.literal, t.unit], color: "#a16207" },
  { tag: [t.operator], color: "#0f766e" },
  { tag: [t.string, t.special(t.string)], color: "#15803d" },
  { tag: [t.regexp, t.escape, t.link], color: "#0e7490" },
  { tag: [t.meta, t.comment], color: "#6b7280", fontStyle: "italic" },
  { tag: t.tagName, color: "#dc2626" },
  { tag: t.attributeName, color: "#a16207" },
  { tag: t.heading, color: "#1d4ed8", fontWeight: "600" },
  { tag: t.emphasis, fontStyle: "italic" },
  { tag: t.strong, fontWeight: "700" },
  { tag: t.strikethrough, textDecoration: "line-through" },
  { tag: t.invalid, color: "#dc2626", backgroundColor: "#fee2e2" },
]);

const divergenceLightTheme = EditorView.theme(
  {
    "&": {
      height: "100%",
      backgroundColor: "#ffffff",
      color: "#09090b",
      fontSize: "13px",
      fontFamily:
        '"SF Mono", "Fira Code", "JetBrains Mono", Menlo, Monaco, "Courier New", monospace',
    },
    ".cm-scroller": { overflow: "auto" },
    ".cm-content": { caretColor: "#18181b" },
    ".cm-cursor, .cm-dropCursor": { borderLeft: "2px solid #18181b" },
    "&.cm-focused .cm-cursor": { borderLeftColor: "#18181b" },
    ".cm-selectionBackground": { backgroundColor: "#e4e4e7" },
    "&.cm-focused .cm-selectionBackground": { backgroundColor: "#e4e4e7" },
    ".cm-selectionLayer .cm-selectionBackground": { backgroundColor: "#e4e4e7" },
    ".cm-gutters": {
      backgroundColor: "#f4f4f5",
      color: "#a1a1aa",
      border: "none",
    },
    ".cm-lineNumbers": { color: "#a1a1aa" },
    ".cm-activeLine": { backgroundColor: "#f4f4f5" },
    ".cm-activeLineGutter": { backgroundColor: "#f4f4f5" },
    ".cm-matchingBracket": {
      backgroundColor: "#e4e4e7",
      color: "#09090b",
    },
    ".cm-nonmatchingBracket": {
      backgroundColor: "#fee2e2",
      color: "#dc2626",
    },
  },
  { dark: false }
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

export const getLanguageExtension = (filePath: string | null) => {
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
};
