import { useEffect, useId, useMemo, useRef, useState } from "react";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { basicSetup } from "codemirror";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  DEFAULT_EDITOR_THEME,
  EmptyState,
  FAST_EASE_OUT,
  LoadingSpinner,
  SOFT_SPRING,
  TabButton,
  ToolbarButton,
  getContentSwapVariants,
  getDiffLineClass,
  getLanguageExtension,
  getSlideUpVariants,
  themeExtensionsById,
  useImportPathCompletion,
  type ChangesMode,
  type EditorThemeId,
} from "../../../shared";

interface AgentSessionChangeDrawerProps {
  isOpen: boolean;
  filePath: string | null;
  projectRootPath?: string | null;
  content: string;
  editorTheme?: EditorThemeId;
  diff?: { text: string; isBinary: boolean } | null;
  diffLoading?: boolean;
  diffError?: string | null;
  diffMode?: ChangesMode | null;
  defaultTab?: "diff" | "edit";
  allowEdit?: boolean;
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

const baseTheme = EditorView.theme({
  "&": {
    height: "100%",
    fontSize: "13px",
    fontFamily:
      '"SF Mono", "Fira Code", "JetBrains Mono", Menlo, Monaco, "Courier New", monospace',
  },
  ".cm-scroller": { overflow: "auto" },
});

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
    [editorTheme],
  );
  const { completionExtensions } = useImportPathCompletion({ filePath, projectRootPath });

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
      doc: "",
      extensions: [
        basicSetup,
        baseTheme,
        ...themeExtensions,
        ...languageExtensions,
        ...completionExtensions,
        ...(isReadOnly ? [EditorView.editable.of(false)] : []),
        EditorView.updateListener.of((update) => {
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
    const createdView = viewRef.current;
    const focusFrame = window.requestAnimationFrame(() => {
      if (viewRef.current === createdView) {
        createdView.focus();
      }
    });

    return () => {
      window.cancelAnimationFrame(focusFrame);
      viewRef.current?.destroy();
      viewRef.current = null;
    };
  }, [completionExtensions, filePath, isReadOnly, languageExtensions, themeExtensions]);

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

function DiffViewer({
  diff,
  isBinary,
  isLoading,
  error,
}: {
  diff: string | null;
  isBinary: boolean;
  isLoading: boolean;
  error: string | null;
}) {
  const lines = useMemo(() => diff?.split("\n") ?? [], [diff]);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <LoadingSpinner>Loading diff...</LoadingSpinner>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-center text-sm text-red-300/90">
        {error}
      </div>
    );
  }

  if (isBinary) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-center text-sm text-subtext">
        Binary file diff is not available.
      </div>
    );
  }

  if (lines.length === 0) {
    return (
      <div className="flex h-full items-center justify-center px-4">
        <EmptyState className="text-xs">No diff available.</EmptyState>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto bg-main/20 font-mono text-[12px] leading-5">
      {lines.map((line, index) => (
        <div key={`${index}-${line}`} className={`whitespace-pre px-4 ${getDiffLineClass(line)}`}>
          {line || " "}
        </div>
      ))}
    </div>
  );
}

function AgentSessionChangeDrawer({
  isOpen,
  filePath,
  projectRootPath = null,
  content,
  editorTheme = DEFAULT_EDITOR_THEME,
  diff = null,
  diffLoading = false,
  diffError = null,
  diffMode = "working",
  defaultTab = "edit",
  allowEdit = true,
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
}: AgentSessionChangeDrawerProps) {
  const shouldReduceMotion = useReducedMotion();
  const tabIdPrefix = useId();
  const [activeTab, setActiveTab] = useState<"diff" | "edit">(defaultTab);
  const canEdit = allowEdit && !isReadOnly;
  const hasDiffState = diff !== null || diffLoading || diffError !== null;
  const showTabBar = canEdit && hasDiffState;
  const diffTabId = `${tabIdPrefix}-diff-tab`;
  const editTabId = `${tabIdPrefix}-edit-tab`;
  const diffPanelId = `${tabIdPrefix}-diff-panel`;
  const editPanelId = `${tabIdPrefix}-edit-panel`;

  useEffect(() => {
    if (!allowEdit && defaultTab === "edit") {
      setActiveTab("diff");
      return;
    }
    setActiveTab(defaultTab);
  }, [allowEdit, defaultTab, filePath]);

  const drawerVariants = useMemo(
    () => getSlideUpVariants(shouldReduceMotion),
    [shouldReduceMotion],
  );
  const contentVariants = useMemo(
    () => getContentSwapVariants(shouldReduceMotion),
    [shouldReduceMotion],
  );
  const drawerTransition = shouldReduceMotion ? FAST_EASE_OUT : SOFT_SPRING;
  const contentTransition = shouldReduceMotion
    ? FAST_EASE_OUT
    : { type: "spring", stiffness: 240, damping: 30, mass: 0.8 };
  const contentKey = filePath ?? "empty";
  const contentVariantKey = `${contentKey}-${activeTab}-${diffMode}`;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="absolute inset-x-0 bottom-0 z-30 flex h-[45%] flex-col border-t border-surface bg-main shadow-xl"
          data-editor-root="true"
          aria-hidden={!isOpen}
          style={{ pointerEvents: isOpen ? "auto" : "none" }}
          variants={drawerVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          transition={drawerTransition}
        >
          <div className="flex items-center justify-between gap-4 border-b border-surface px-4 py-2">
            <div className="min-w-0">
              <p className="text-xs text-subtext/70">Quick Edit</p>
              <p className="truncate text-sm text-text">
                {filePath ?? "No file selected"}
                {isDirty ? <span className="text-accent"> *</span> : null}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {isReadOnly && (
                <span className="rounded bg-surface px-2 py-1 text-[10px] text-subtext">
                  Read-only
                </span>
              )}
              {allowEdit && (
                <ToolbarButton
                  onClick={onSave}
                  disabled={isSaving || isLoading || isReadOnly || !filePath}
                >
                  {isSaving ? "Saving..." : "Save"}
                </ToolbarButton>
              )}
              <ToolbarButton onClick={onClose}>Close</ToolbarButton>
            </div>
          </div>
          {showTabBar && (
            <div
              className="flex items-center border-b border-surface text-xs"
              role="tablist"
              aria-label="Quick edit tabs"
            >
              <TabButton
                active={activeTab === "diff"}
                role="tab"
                id={diffTabId}
                aria-selected={activeTab === "diff"}
                aria-controls={diffPanelId}
                tabIndex={activeTab === "diff" ? 0 : -1}
                onClick={() => setActiveTab("diff")}
              >
                Diff
              </TabButton>
              {allowEdit && (
                <TabButton
                  active={activeTab === "edit"}
                  role="tab"
                  id={editTabId}
                  aria-selected={activeTab === "edit"}
                  aria-controls={editPanelId}
                  tabIndex={activeTab === "edit" ? 0 : -1}
                  onClick={() => setActiveTab("edit")}
                >
                  Edit
                </TabButton>
              )}
            </div>
          )}
          {largeFileWarning && (
            <div className="border-b border-yellow-400/20 bg-yellow-400/10 px-4 py-2 text-[11px] text-yellow-200/90">
              {largeFileWarning}
            </div>
          )}
          {loadError && (
            <div className="border-b border-red-500/20 bg-red-500/10 px-4 py-2 text-[11px] text-red-300/90">
              {loadError}
            </div>
          )}
          {saveError && (
            <div className="border-b border-red-500/20 bg-red-500/10 px-4 py-2 text-[11px] text-red-300/90">
              {saveError}
            </div>
          )}
          <div className="flex-1 min-h-0">
            <AnimatePresence mode="wait" initial={false}>
              {activeTab === "diff" && hasDiffState ? (
                <motion.div
                  key="diff"
                  className="h-full w-full"
                  role={showTabBar ? "tabpanel" : undefined}
                  id={showTabBar ? diffPanelId : undefined}
                  aria-labelledby={showTabBar ? diffTabId : undefined}
                  variants={contentVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  transition={contentTransition}
                >
                  <DiffViewer
                    diff={diff?.text ?? null}
                    isBinary={diff?.isBinary ?? false}
                    isLoading={diffLoading}
                    error={diffError}
                  />
                </motion.div>
              ) : isLoading ? (
                <motion.div
                  key="loading"
                  className="flex h-full items-center justify-center text-sm text-subtext"
                  role={showTabBar ? "tabpanel" : undefined}
                  id={showTabBar ? editPanelId : undefined}
                  aria-labelledby={showTabBar ? editTabId : undefined}
                  variants={contentVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  transition={contentTransition}
                >
                  <LoadingSpinner>Loading file...</LoadingSpinner>
                </motion.div>
              ) : (
                <motion.div
                  key={contentVariantKey}
                  className="h-full w-full"
                  role={showTabBar ? "tabpanel" : undefined}
                  id={showTabBar ? editPanelId : undefined}
                  aria-labelledby={showTabBar ? editTabId : undefined}
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
                    isReadOnly={!canEdit}
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

export default AgentSessionChangeDrawer;
