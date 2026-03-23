import { useEffect, useMemo, useRef } from "react";
import { EditorState, type Extension } from "@codemirror/state";
import { search, searchKeymap, highlightSelectionMatches } from "@codemirror/search";
import { EditorView, keymap, type KeyBinding } from "@codemirror/view";
import { basicSetup } from "codemirror";
import { DEFAULT_EDITOR_THEME, type EditorThemeId } from "../../lib/editorThemes.pure";
import { getLanguageExtension, themeExtensionsById } from "../../lib/editorTheme.pure";
import { useImportPathCompletion } from "../../hooks/useImportPathCompletion";

interface CodeEditorCoreProps {
  filePath: string | null;
  content: string;
  editorTheme?: EditorThemeId;
  projectRootPath?: string | null;
  isReadOnly?: boolean;
  autoFocus?: boolean;
  revealRequest?: {
    requestKey: number;
    line: number;
    column?: number | null;
  } | null;
  additionalExtensions?: Extension[];
  additionalKeyBindings?: KeyBinding[];
  onChange?: (next: string) => void;
  onSave?: () => void;
  onClose?: () => void;
}

const EMPTY_EXTENSIONS: Extension[] = [];
const EMPTY_KEY_BINDINGS: KeyBinding[] = [];

const baseTheme = EditorView.theme({
  "&": {
    height: "100%",
    fontSize: "13px",
    fontFamily:
      '"SF Mono", "Fira Code", "JetBrains Mono", Menlo, Monaco, "Courier New", monospace',
  },
  ".cm-scroller": { overflow: "auto" },
});

function CodeEditorCore({
  filePath,
  content,
  editorTheme = DEFAULT_EDITOR_THEME,
  projectRootPath = null,
  isReadOnly = false,
  autoFocus = true,
  revealRequest = null,
  additionalExtensions = EMPTY_EXTENSIONS,
  additionalKeyBindings = EMPTY_KEY_BINDINGS,
  onChange,
  onSave,
  onClose,
}: CodeEditorCoreProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const onSaveRef = useRef(onSave);
  const onCloseRef = useRef(onClose);
  const lastRevealRequestKeyRef = useRef<number | null>(null);
  const languageExtensions = useMemo(() => getLanguageExtension(filePath), [filePath]);
  const themeExtensions = useMemo(
    () => themeExtensionsById[editorTheme] ?? themeExtensionsById[DEFAULT_EDITOR_THEME],
    [editorTheme],
  );
  const { completionExtensions } = useImportPathCompletion({ filePath, projectRootPath });
  const keyBindings = useMemo<KeyBinding[]>(
    () => [
      ...searchKeymap,
      ...additionalKeyBindings,
      {
        key: "Mod-s",
        run: () => {
          onSaveRef.current?.();
          return true;
        },
      },
      {
        key: "Escape",
        run: () => {
          onCloseRef.current?.();
          return true;
        },
      },
    ],
    [additionalKeyBindings],
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

    viewRef.current?.destroy();
    lastRevealRequestKeyRef.current = null;

    const state = EditorState.create({
      doc: "",
      extensions: [
        basicSetup,
        baseTheme,
        search({ top: true }),
        highlightSelectionMatches(),
        ...themeExtensions,
        ...languageExtensions,
        ...completionExtensions,
        ...additionalExtensions,
        ...(isReadOnly ? [EditorView.editable.of(false)] : []),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChangeRef.current?.(update.state.doc.toString());
          }
        }),
        keymap.of(keyBindings),
      ],
    });

    const view = new EditorView({
      state,
      parent: containerRef.current,
    });
    viewRef.current = view;

    const focusFrame = autoFocus
      ? window.requestAnimationFrame(() => {
          if (viewRef.current === view) {
            view.focus();
          }
        })
      : null;

    return () => {
      if (focusFrame !== null) {
        window.cancelAnimationFrame(focusFrame);
      }
      viewRef.current?.destroy();
      viewRef.current = null;
    };
  }, [
    additionalExtensions,
    autoFocus,
    completionExtensions,
    isReadOnly,
    keyBindings,
    languageExtensions,
    themeExtensions,
  ]);

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

  useEffect(() => {
    const view = viewRef.current;
    if (!view || !revealRequest) {
      return;
    }
    if (lastRevealRequestKeyRef.current === revealRequest.requestKey) {
      return;
    }

    const lineNumber = Math.min(
      Math.max(1, revealRequest.line),
      Math.max(1, view.state.doc.lines),
    );
    const line = view.state.doc.line(lineNumber);
    const column = Math.max(1, revealRequest.column ?? 1);
    const anchor = Math.min(line.from + column - 1, line.to);

    view.dispatch({
      selection: { anchor },
      scrollIntoView: true,
    });
    if (autoFocus) {
      view.focus();
    }
    lastRevealRequestKeyRef.current = revealRequest.requestKey;
  }, [autoFocus, content, revealRequest]);

  return <div ref={containerRef} className="h-full w-full" />;
}

export default CodeEditorCore;
