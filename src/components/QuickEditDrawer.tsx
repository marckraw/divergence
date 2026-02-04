import { useEffect, useMemo, useRef } from "react";
import {
  autocompletion,
  completeAnyWord,
  type Completion,
  type CompletionContext,
  type CompletionResult,
} from "@codemirror/autocomplete";
import { EditorState, type Extension } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { basicSetup } from "codemirror";
import { css } from "@codemirror/lang-css";
import { html } from "@codemirror/lang-html";
import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
import { rust } from "@codemirror/lang-rust";
import { json } from "@codemirror/lang-json";
import { markdown } from "@codemirror/lang-markdown";
import { yaml } from "@codemirror/lang-yaml";
import { oneDark } from "@codemirror/theme-one-dark";
import { dracula } from "@uiw/codemirror-theme-dracula";
import { githubDark, githubLight } from "@uiw/codemirror-theme-github";
import { vscodeDark, vscodeLight } from "@uiw/codemirror-theme-vscode";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";
import { readDir, readTextFile } from "@tauri-apps/plugin-fs";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { DEFAULT_EDITOR_THEME, type EditorThemeId } from "../lib/editorThemes";
import {
  FAST_EASE_OUT,
  SOFT_SPRING,
  getContentSwapVariants,
  getSlideUpVariants,
} from "../lib/motion";

interface QuickEditDrawerProps {
  isOpen: boolean;
  filePath: string | null;
  projectRootPath?: string | null;
  content: string;
  editorTheme?: EditorThemeId;
  isDirty: boolean;
  isSaving: boolean;
  isLoading: boolean;
  isReadOnly: boolean;
  loadError: string | null;
  saveError: string | null;
  largeFileWarning: string | null;
  onChange: (next: string) => void;
  onSave: () => void;
  onClose: () => void;
}

const syntaxTheme = HighlightStyle.define([
  { tag: t.keyword, color: "#cba6f7", fontWeight: "600" },
  { tag: [t.name, t.deleted, t.character, t.macroName, t.variableName], color: "#e6e9ef" },
  { tag: t.propertyName, color: "#f8bd96" },
  { tag: [t.function(t.variableName), t.labelName], color: "#8aadf4" },
  { tag: [t.color, t.constant(t.name), t.standard(t.name)], color: "#f5c2e7" },
  { tag: [t.definition(t.name), t.separator, t.punctuation], color: "#cad3f5" },
  { tag: [t.typeName, t.className], color: "#fab387" },
  { tag: [t.number, t.bool, t.null, t.atom, t.literal, t.unit], color: "#f9e2af" },
  { tag: [t.operator], color: "#94e2d5" },
  { tag: [t.string, t.special(t.string)], color: "#a6e3a1" },
  { tag: [t.regexp, t.escape, t.link], color: "#74c7ec" },
  { tag: [t.meta, t.comment], color: "#9aa2b2", fontStyle: "italic" },
  { tag: t.tagName, color: "#f38ba8" },
  { tag: t.attributeName, color: "#f9e2af" },
  { tag: t.heading, color: "#89b4fa", fontWeight: "600" },
  { tag: t.emphasis, fontStyle: "italic" },
  { tag: t.strong, fontWeight: "700" },
  { tag: t.strikethrough, textDecoration: "line-through" },
  { tag: t.invalid, color: "#f38ba8", backgroundColor: "#f38ba81a" },
]);

const baseTheme = EditorView.theme({
  "&": {
    height: "100%",
    fontSize: "13px",
    fontFamily:
      '"SF Mono", "Fira Code", "JetBrains Mono", Menlo, Monaco, "Courier New", monospace',
  },
  ".cm-scroller": { overflow: "auto" },
});

const divergenceTheme = EditorView.theme(
  {
    "&": {
      height: "100%",
      backgroundColor: "#181825",
      color: "#cdd6f4",
      fontSize: "13px",
      fontFamily:
        '"SF Mono", "Fira Code", "JetBrains Mono", Menlo, Monaco, "Courier New", monospace',
    },
    ".cm-scroller": { overflow: "auto" },
    ".cm-content": { caretColor: "#f5e0dc" },
    ".cm-cursor, .cm-dropCursor": { borderLeft: "2px solid #f5e0dc" },
    "&.cm-focused .cm-cursor": { borderLeftColor: "#f5e0dc" },
    ".cm-selectionBackground": { backgroundColor: "#45475a" },
    "&.cm-focused .cm-selectionBackground": { backgroundColor: "#45475a" },
    ".cm-selectionLayer .cm-selectionBackground": { backgroundColor: "#45475a" },
    ".cm-gutters": {
      backgroundColor: "#1e1e2e",
      color: "#6c7086",
      border: "none",
    },
    ".cm-lineNumbers": { color: "#6c7086" },
    ".cm-activeLine": { backgroundColor: "#1e1e2e" },
    ".cm-activeLineGutter": { backgroundColor: "#1e1e2e" },
    ".cm-matchingBracket": {
      backgroundColor: "#313244",
      color: "#f5e0dc",
    },
    ".cm-nonmatchingBracket": {
      backgroundColor: "#f38ba81a",
      color: "#f38ba8",
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
      backgroundColor: "#f8f9fc",
      color: "#1f2937",
      fontSize: "13px",
      fontFamily:
        '"SF Mono", "Fira Code", "JetBrains Mono", Menlo, Monaco, "Courier New", monospace',
    },
    ".cm-scroller": { overflow: "auto" },
    ".cm-content": { caretColor: "#2d6cdf" },
    ".cm-cursor, .cm-dropCursor": { borderLeft: "2px solid #2d6cdf" },
    "&.cm-focused .cm-cursor": { borderLeftColor: "#2d6cdf" },
    ".cm-selectionBackground": { backgroundColor: "#d7deef" },
    "&.cm-focused .cm-selectionBackground": { backgroundColor: "#d7deef" },
    ".cm-selectionLayer .cm-selectionBackground": { backgroundColor: "#d7deef" },
    ".cm-gutters": {
      backgroundColor: "#eef0f6",
      color: "#8a94b3",
      border: "none",
    },
    ".cm-lineNumbers": { color: "#8a94b3" },
    ".cm-activeLine": { backgroundColor: "#eef0f6" },
    ".cm-activeLineGutter": { backgroundColor: "#eef0f6" },
    ".cm-matchingBracket": {
      backgroundColor: "#d7deef",
      color: "#1f2937",
    },
    ".cm-nonmatchingBracket": {
      backgroundColor: "#fee2e2",
      color: "#dc2626",
    },
  },
  { dark: false }
);

const divergenceHighlightLight = syntaxHighlighting(syntaxThemeLight, { fallback: true });

const themeExtensionsById: Record<EditorThemeId, Extension[]> = {
  divergence: [divergenceTheme, divergenceHighlight],
  "divergence-light": [divergenceLightTheme, divergenceHighlightLight],
  "one-dark": [oneDark],
  dracula: [dracula],
  "github-dark": [githubDark],
  "github-light": [githubLight],
  "vscode-dark": [vscodeDark],
  "vscode-light": [vscodeLight],
};

const getLanguageExtension = (filePath: string | null) => {
  if (!filePath) {
    return [];
  }
  const lower = filePath.toLowerCase();
  if (lower.endsWith(".html") || lower.endsWith(".htm")) {
    return [html()];
  }
  if (lower.endsWith(".css") || lower.endsWith(".scss") || lower.endsWith(".sass") || lower.endsWith(".less")) {
    return [css()];
  }
  if (lower.endsWith(".ts") || lower.endsWith(".tsx") || lower.endsWith(".mts") || lower.endsWith(".cts")) {
    return [javascript({ typescript: true, jsx: lower.endsWith(".tsx") })];
  }
  if (lower.endsWith(".js") || lower.endsWith(".jsx") || lower.endsWith(".mjs") || lower.endsWith(".cjs")) {
    return [javascript({ jsx: lower.endsWith(".jsx") })];
  }
  if (lower.endsWith(".md") || lower.endsWith(".markdown") || lower.endsWith(".mdx")) {
    return [markdown()];
  }
  if (lower.endsWith(".py") || lower.endsWith(".pyi")) {
    return [python()];
  }
  if (lower.endsWith(".rs")) {
    return [rust()];
  }
  if (lower.endsWith(".json") || lower.endsWith(".jsonc") || lower.endsWith(".json5")) {
    return [json()];
  }
  if (lower.endsWith(".yaml") || lower.endsWith(".yml")) {
    return [yaml()];
  }
  return [];
};

const IMPORT_COMPLETION_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".mts",
  ".cts",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".d.ts",
]);

const OMIT_EXTENSION_FOR_IMPORT = new Set([
  "ts",
  "tsx",
  "mts",
  "cts",
  "js",
  "jsx",
  "mjs",
  "cjs",
  "d.ts",
]);

const IMPORT_PATH_MATCHERS = [
  /(?:import|export)\s+[^'"]*from\s+["']([^"']*)$/,
  /import\s+["']([^"']*)$/,
  /(?:import|require)\(\s*["']([^"']*)$/,
];

const DIR_CACHE_TTL_MS = 10_000;
const PACKAGE_CACHE_TTL_MS = 60_000;
const dirCache = new Map<string, { at: number; entries: { name: string; isDir: boolean }[] }>();
const packageCache = new Map<string, { at: number; names: string[] }>();

const normalizePath = (value: string) => value.replace(/\\/g, "/");

const trimTrailingSlash = (value: string) => value.replace(/\/+$/g, "");

const getDirname = (value: string) => {
  const normalized = normalizePath(value);
  const trimmed = trimTrailingSlash(normalized);
  const lastSlash = trimmed.lastIndexOf("/");
  if (lastSlash < 0) {
    return trimmed;
  }
  if (lastSlash === 0) {
    return "/";
  }
  return trimmed.slice(0, lastSlash);
};

const joinPath = (base: string, segment: string) => {
  if (!segment) {
    return base;
  }
  const normalizedBase = normalizePath(base);
  const normalizedSegment = normalizePath(segment);
  if (normalizedSegment.startsWith("/") || /^[A-Za-z]:\//.test(normalizedSegment)) {
    return normalizedSegment;
  }
  if (normalizedBase.endsWith("/")) {
    return `${normalizedBase}${normalizedSegment}`;
  }
  return `${normalizedBase}/${normalizedSegment}`;
};

const resolvePath = (base: string, relative: string) => {
  const normalizedRelative = normalizePath(relative);
  if (normalizedRelative.startsWith("/") || /^[A-Za-z]:\//.test(normalizedRelative)) {
    return normalizedRelative;
  }

  const normalizedBase = normalizePath(base);
  const hasLeadingSlash = normalizedBase.startsWith("/");
  let baseParts = normalizedBase.split("/").filter(Boolean);
  let prefix = hasLeadingSlash ? "/" : "";

  if (baseParts[0]?.endsWith(":")) {
    prefix = `${baseParts[0]}/`;
    baseParts = baseParts.slice(1);
  }

  const relParts = normalizedRelative.split("/").filter(Boolean);
  const parts = [...baseParts];
  for (const part of relParts) {
    if (part === ".") {
      continue;
    }
    if (part === "..") {
      if (parts.length > 0) {
        parts.pop();
      }
      continue;
    }
    parts.push(part);
  }

  return `${prefix}${parts.join("/")}`;
};

const isImportCompletionEnabled = (filePath: string | null) => {
  if (!filePath) {
    return false;
  }
  const lower = filePath.toLowerCase();
  return Array.from(IMPORT_COMPLETION_EXTENSIONS).some(ext => lower.endsWith(ext));
};

const buildImportLabel = (name: string) => {
  const lower = name.toLowerCase();
  if (lower.endsWith(".d.ts")) {
    return name.slice(0, -5);
  }
  const lastDot = lower.lastIndexOf(".");
  if (lastDot <= 0) {
    return name;
  }
  const ext = lower.slice(lastDot + 1);
  if (OMIT_EXTENSION_FOR_IMPORT.has(ext)) {
    return name.slice(0, lastDot);
  }
  return name;
};

const getImportPathMatch = (context: CompletionContext) => {
  const line = context.state.doc.lineAt(context.pos);
  const before = line.text.slice(0, context.pos - line.from);
  for (const matcher of IMPORT_PATH_MATCHERS) {
    const match = before.match(matcher);
    if (match) {
      return {
        value: match[1],
        from: context.pos - match[1].length,
      };
    }
  }
  return null;
};

const readDirCached = async (path: string) => {
  const now = Date.now();
  const cached = dirCache.get(path);
  if (cached && now - cached.at < DIR_CACHE_TTL_MS) {
    return cached.entries;
  }

  try {
    const entries = await readDir(path);
    const normalized = entries
      .map(entry => ({
        name: entry.name ?? "",
        isDir: Boolean(entry.isDirectory),
      }))
      .filter(entry => entry.name.length > 0)
      .sort((a, b) => {
        if (a.isDir !== b.isDir) {
          return a.isDir ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      });
    dirCache.set(path, { at: now, entries: normalized });
    return normalized;
  } catch {
    return [];
  }
};

const readPackageNamesCached = async (rootPath: string) => {
  const now = Date.now();
  const cached = packageCache.get(rootPath);
  if (cached && now - cached.at < PACKAGE_CACHE_TTL_MS) {
    return cached.names;
  }

  try {
    const packagePath = joinPath(rootPath, "package.json");
    const raw = await readTextFile(packagePath);
    const parsed = JSON.parse(raw);
    const names = new Set<string>();
    const buckets = [
      parsed?.dependencies,
      parsed?.devDependencies,
      parsed?.peerDependencies,
      parsed?.optionalDependencies,
    ];
    for (const bucket of buckets) {
      if (!bucket || typeof bucket !== "object") {
        continue;
      }
      for (const name of Object.keys(bucket)) {
        names.add(name);
      }
    }
    const list = Array.from(names).sort();
    packageCache.set(rootPath, { at: now, names: list });
    return list;
  } catch {
    packageCache.set(rootPath, { at: now, names: [] });
    return [];
  }
};

const getRelativePathCompletions = async (
  filePath: string,
  typed: string
): Promise<Completion[]> => {
  const normalizedTyped = normalizePath(typed);
  const lastSlash = normalizedTyped.lastIndexOf("/");
  const prefixDir = lastSlash >= 0 ? normalizedTyped.slice(0, lastSlash + 1) : "";
  const partial = lastSlash >= 0 ? normalizedTyped.slice(lastSlash + 1) : normalizedTyped;
  const baseDir = getDirname(filePath);
  const targetDir = resolvePath(baseDir, prefixDir || ".");
  const entries = await readDirCached(targetDir);

  return entries
    .filter(entry => (partial ? entry.name.startsWith(partial) : true))
    .map(entry => {
      if (entry.isDir) {
        const label = `${prefixDir}${entry.name}/`;
        return { label, apply: label, type: "folder" } satisfies Completion;
      }
      const labelName = buildImportLabel(entry.name);
      const label = `${prefixDir}${labelName}`;
      return { label, apply: label, type: "file" } satisfies Completion;
    });
};

const getPackageCompletions = async (
  rootPath: string,
  typed: string
): Promise<Completion[]> => {
  const names = await readPackageNamesCached(rootPath);
  return names
    .filter(name => (typed ? name.startsWith(typed) : true))
    .map(name => ({ label: name, type: "module" } satisfies Completion));
};

const createImportPathCompletionSource = (
  filePath: string | null,
  projectRootPath: string | null
) => {
  if (!filePath || !isImportCompletionEnabled(filePath)) {
    return null;
  }

  return async (context: CompletionContext): Promise<CompletionResult | null> => {
    const match = getImportPathMatch(context);
    if (!match) {
      return null;
    }

    const { value, from } = match;
    const isRelative = value.startsWith(".") || value.startsWith("/");

    if (isRelative) {
      const options = await getRelativePathCompletions(filePath, value);
      if (options.length === 0) {
        return null;
      }
      return {
        from,
        options,
        validFor: /^[^"'`]*$/,
      };
    }

    if (!projectRootPath) {
      return null;
    }

    const options = await getPackageCompletions(projectRootPath, value);
    if (options.length === 0) {
      return null;
    }

    return {
      from,
      options,
      validFor: /^[^"'`]*$/,
    };
  };
};

const buildCompletionExtensions = (filePath: string | null, projectRootPath: string | null) => {
  const sources = [completeAnyWord];
  const importSource = createImportPathCompletionSource(filePath, projectRootPath);
  if (importSource) {
    sources.unshift(importSource);
  }
  return [autocompletion({ override: sources })];
};

function CodeEditor({
  filePath,
  content,
  editorTheme,
  projectRootPath,
  isReadOnly,
  onChange,
  onSave,
  onClose,
}: {
  filePath: string | null;
  content: string;
  editorTheme: EditorThemeId;
  projectRootPath: string | null;
  isReadOnly: boolean;
  onChange: (next: string) => void;
  onSave: () => void;
  onClose: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const onSaveRef = useRef(onSave);
  const onCloseRef = useRef(onClose);
  const languageExtensions = useMemo(() => getLanguageExtension(filePath), [filePath]);
  const themeExtensions = useMemo(
    () => themeExtensionsById[editorTheme] ?? themeExtensionsById[DEFAULT_EDITOR_THEME],
    [editorTheme]
  );
  const completionExtensions = useMemo(
    () => buildCompletionExtensions(filePath, projectRootPath),
    [filePath, projectRootPath]
  );

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    if (viewRef.current) {
      viewRef.current.destroy();
      viewRef.current = null;
    }

    const state = EditorState.create({
      doc: content,
      extensions: [
        basicSetup,
        baseTheme,
        ...themeExtensions,
        ...languageExtensions,
        ...completionExtensions,
        ...(isReadOnly ? [EditorView.editable.of(false)] : []),
        EditorView.updateListener.of(update => {
          if (update.docChanged) {
            onChangeRef.current(update.state.doc.toString());
          }
        }),
        keymap.of([
          {
            key: "Mod-s",
            run: () => {
              onSaveRef.current();
              return true;
            },
          },
          {
            key: "Escape",
            run: () => {
              onCloseRef.current();
              return true;
            },
          },
        ]),
      ],
    });

    viewRef.current = new EditorView({
      state,
      parent: containerRef.current,
    });

    return () => {
      viewRef.current?.destroy();
      viewRef.current = null;
    };
  }, [filePath, isReadOnly, languageExtensions, themeExtensions, completionExtensions]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) {
      return;
    }
    const current = view.state.doc.toString();
    if (current !== content) {
      view.dispatch({
        changes: { from: 0, to: current.length, insert: content },
      });
    }
  }, [content]);

  return <div ref={containerRef} className="h-full w-full" />;
}

function QuickEditDrawer({
  isOpen,
  filePath,
  projectRootPath = null,
  content,
  editorTheme = DEFAULT_EDITOR_THEME,
  isDirty,
  isSaving,
  isLoading,
  isReadOnly,
  loadError,
  saveError,
  largeFileWarning,
  onChange,
  onSave,
  onClose,
}: QuickEditDrawerProps) {
  const shouldReduceMotion = useReducedMotion();
  const drawerVariants = useMemo(
    () => getSlideUpVariants(shouldReduceMotion),
    [shouldReduceMotion]
  );
  const contentVariants = useMemo(
    () => getContentSwapVariants(shouldReduceMotion),
    [shouldReduceMotion]
  );
  const drawerTransition = shouldReduceMotion ? FAST_EASE_OUT : SOFT_SPRING;
  const contentTransition = shouldReduceMotion
    ? FAST_EASE_OUT
    : { type: "spring", stiffness: 240, damping: 30, mass: 0.8 };
  const contentKey = filePath ?? "empty";

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="absolute inset-x-0 bottom-0 h-[45%] bg-main border-t border-surface shadow-xl flex flex-col"
          data-editor-root="true"
          aria-hidden={!isOpen}
          style={{ pointerEvents: isOpen ? "auto" : "none" }}
          variants={drawerVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          transition={drawerTransition}
        >
          <div className="flex items-center justify-between gap-4 px-4 py-2 border-b border-surface">
            <div className="min-w-0">
              <p className="text-xs text-subtext/70">Quick Edit</p>
              <p className="text-sm text-text truncate">
                {filePath ?? "No file selected"}
                {isDirty ? <span className="text-accent"> *</span> : null}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {isReadOnly && (
                <span className="text-[10px] px-2 py-1 rounded bg-surface text-subtext">
                  Read-only
                </span>
              )}
              <button
                type="button"
                className="text-xs px-2 py-1 rounded border border-surface text-subtext hover:text-text hover:bg-surface/50 disabled:opacity-40"
                onClick={onSave}
                disabled={isSaving || isLoading || isReadOnly || !filePath}
              >
                {isSaving ? "Saving..." : "Save"}
              </button>
              <button
                type="button"
                className="text-xs px-2 py-1 rounded border border-surface text-subtext hover:text-text hover:bg-surface/50"
                onClick={onClose}
              >
                Close
              </button>
            </div>
          </div>
          {largeFileWarning && (
            <div className="px-4 py-2 text-[11px] text-yellow-200/90 bg-yellow-400/10 border-b border-yellow-400/20">
              {largeFileWarning}
            </div>
          )}
          {loadError && (
            <div className="px-4 py-2 text-[11px] text-red-300/90 bg-red-500/10 border-b border-red-500/20">
              {loadError}
            </div>
          )}
          {saveError && (
            <div className="px-4 py-2 text-[11px] text-red-300/90 bg-red-500/10 border-b border-red-500/20">
              {saveError}
            </div>
          )}
          <div className="flex-1 min-h-0">
            <AnimatePresence mode="wait" initial={false}>
              {isLoading ? (
                <motion.div
                  key="loading"
                  className="h-full flex items-center justify-center text-sm text-subtext"
                  variants={contentVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  transition={contentTransition}
                >
                  <div className="flex items-center gap-2">
                    <span className="spinner" />
                    Loading file...
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key={contentKey}
                  className="h-full w-full"
                  variants={contentVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  transition={contentTransition}
                >
                  <CodeEditor
                    filePath={filePath}
                    content={content}
                    editorTheme={editorTheme}
                    projectRootPath={projectRootPath}
                    isReadOnly={isReadOnly}
                    onChange={onChange}
                    onSave={onSave}
                    onClose={onClose}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default QuickEditDrawer;
