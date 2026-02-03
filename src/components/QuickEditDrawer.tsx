import { useEffect, useMemo, useRef } from "react";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { basicSetup } from "codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
import { rust } from "@codemirror/lang-rust";
import { json } from "@codemirror/lang-json";

interface QuickEditDrawerProps {
  isOpen: boolean;
  filePath: string | null;
  content: string;
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

const editorTheme = EditorView.theme({
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
  ".cm-gutters": {
    backgroundColor: "#1e1e2e",
    color: "#bac2de",
    border: "none",
  },
  ".cm-activeLine": { backgroundColor: "#1e1e2e" },
  ".cm-selectionBackground": { backgroundColor: "#585b7066" },
  ".cm-selectionLayer .cm-selectionBackground": { backgroundColor: "#585b7066" },
});

const getLanguageExtension = (filePath: string | null) => {
  if (!filePath) {
    return [];
  }
  const lower = filePath.toLowerCase();
  if (lower.endsWith(".ts") || lower.endsWith(".tsx")) {
    return [javascript({ typescript: true, jsx: lower.endsWith(".tsx") })];
  }
  if (lower.endsWith(".js") || lower.endsWith(".jsx")) {
    return [javascript({ jsx: lower.endsWith(".jsx") })];
  }
  if (lower.endsWith(".py")) {
    return [python()];
  }
  if (lower.endsWith(".rs")) {
    return [rust()];
  }
  if (lower.endsWith(".json")) {
    return [json()];
  }
  return [];
};

function CodeEditor({
  filePath,
  content,
  isReadOnly,
  onChange,
  onSave,
  onClose,
}: {
  filePath: string | null;
  content: string;
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
        editorTheme,
        ...languageExtensions,
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
  }, [filePath, isReadOnly, languageExtensions]);

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
  content,
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
  if (!isOpen) {
    return null;
  }

  return (
    <div className="absolute inset-x-0 bottom-0 h-[45%] bg-main border-t border-surface shadow-xl flex flex-col" data-editor-root="true">
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
        {isLoading ? (
          <div className="h-full flex items-center justify-center text-sm text-subtext">
            <div className="flex items-center gap-2">
              <span className="spinner" />
              Loading file...
            </div>
          </div>
        ) : (
          <CodeEditor
            filePath={filePath}
            content={content}
            isReadOnly={isReadOnly}
            onChange={onChange}
            onSave={onSave}
            onClose={onClose}
          />
        )}
      </div>
    </div>
  );
}

export default QuickEditDrawer;
