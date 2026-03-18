import { useEffect, useId, useMemo, useRef, useState } from "react";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { basicSetup } from "codemirror";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { DEFAULT_EDITOR_THEME, type EditorThemeId } from "../../../shared";
import {
  FAST_EASE_OUT,
  SOFT_SPRING,
  Button,
  LoadingSpinner,
  Markdown,
  getContentSwapVariants,
  getSlideUpVariants,
} from "../../../shared";
import { TabButton, Textarea, ToolbarButton } from "../../../shared";
import type { ChangesMode } from "../../../entities";
import {
  buildAnchorLabel,
  parseUnifiedDiffLines,
  type DiffReviewAnchor,
  type DiffReviewComment,
  type ParsedDiffLine,
} from "../../../features/diff-review";
import { getDiffLineClass } from "../lib/quickEdit.pure";
import { themeExtensionsById, getLanguageExtension } from "../lib/editorTheme.pure";
import { useImportPathCompletion } from "../model/useImportPathCompletion";
import QuickEditDrawerPresentational from "./QuickEditDrawer.presentational";

interface QuickEditDrawerProps {
  isOpen: boolean;
  filePath: string | null;
  projectRootPath?: string | null;
  content: string;
  editorTheme?: EditorThemeId;
  diff?: { text: string; isBinary: boolean } | null;
  diffLoading?: boolean;
  diffError?: string | null;
  diffMode?: ChangesMode;
  reviewComments?: DiffReviewComment[];
  defaultTab?: "diff" | "edit" | "view";
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
  onAddDiffComment?: (anchor: DiffReviewAnchor, message: string) => void;
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
    [editorTheme]
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
      // Content is synced by the dedicated content effect below.
      doc: "",
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

function DiffViewer({
  filePath,
  diff,
  mode,
  reviewComments,
  onAddComment,
  isBinary,
  isLoading,
  error,
}: {
  filePath: string | null;
  diff: string | null;
  mode: ChangesMode;
  reviewComments: DiffReviewComment[];
  onAddComment?: (anchor: DiffReviewAnchor, message: string) => void;
  isBinary: boolean;
  isLoading: boolean;
  error: string | null;
}) {
  const lines = useMemo(() => parseUnifiedDiffLines(diff), [diff]);
  const lineByIndex = useMemo(() => {
    const mapped = new Map<number, typeof lines[number]>();
    lines.forEach((line) => {
      mapped.set(line.index, line);
    });
    return mapped;
  }, [lines]);
  const commentsByLine = useMemo(() => {
    const mapped = new Map<number, DiffReviewComment[]>();
    reviewComments.forEach((comment) => {
      const list = mapped.get(comment.anchor.displayLineIndex) ?? [];
      list.push(comment);
      mapped.set(comment.anchor.displayLineIndex, list);
    });
    return mapped;
  }, [reviewComments]);
  const [composerLineIndex, setComposerLineIndex] = useState<number | null>(null);
  const [composerText, setComposerText] = useState("");
  const [composerAnchor, setComposerAnchor] = useState<DiffReviewAnchor | null>(null);
  const [rangeStartIndex, setRangeStartIndex] = useState<number | null>(null);

  const openSingleComposer = (line: ParsedDiffLine) => {
    if (!filePath) {
      return;
    }

    setComposerAnchor({
      filePath,
      mode,
      lineKind: line.kind === "added" ? "added" : "removed",
      oldLine: line.oldLine,
      newLine: line.newLine,
      displayLineIndex: line.index,
      lineText: line.text,
    });
    setComposerLineIndex(line.index);
    setComposerText("");
    setRangeStartIndex(null);
  };

  const openRangeComposer = (startIndex: number, endIndex: number) => {
    if (!filePath) {
      return;
    }
    const from = Math.min(startIndex, endIndex);
    const to = Math.max(startIndex, endIndex);
    const startLine = lineByIndex.get(from);
    const endLine = lineByIndex.get(to);
    if (!startLine || !endLine) {
      return;
    }

    setComposerAnchor({
      filePath,
      mode,
      lineKind: "range",
      oldLine: startLine.oldLine,
      newLine: startLine.newLine,
      endOldLine: endLine.oldLine,
      endNewLine: endLine.newLine,
      displayLineIndex: from,
      endDisplayLineIndex: to,
      lineText: startLine.text,
      endLineText: endLine.text,
    });
    setComposerLineIndex(from);
    setComposerText("");
    setRangeStartIndex(null);
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center text-sm text-subtext">
        <LoadingSpinner>Loading diff...</LoadingSpinner>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center text-sm text-red">
        {error}
      </div>
    );
  }

  if (isBinary) {
    return (
      <div className="h-full flex items-center justify-center text-sm text-subtext">
        Binary file diff is not available.
      </div>
    );
  }

  if (!diff) {
    return (
      <div className="h-full flex items-center justify-center text-sm text-subtext">
        No diff available.
      </div>
    );
  }

  return (
    <div className="h-full w-full overflow-auto font-mono text-[11px] leading-5">
      {rangeStartIndex !== null && (
        <div className="sticky top-0 z-10 mx-2 mt-2 mb-1 px-2 py-1 rounded border border-accent/30 bg-accent/10 text-[10px] text-subtext flex items-center justify-between gap-2">
          <span>
            Select range end line, then click <span className="text-text">Range End</span>.
            You can end on the same line for a one-line selection.
          </span>
          <Button
            type="button"
            className="text-subtext hover:text-text"
            onClick={() => setRangeStartIndex(null)}
            variant="ghost"
            size="xs"
          >
            Cancel
          </Button>
        </div>
      )}
      {lines.map((line) => {
        const lineComments = commentsByLine.get(line.index) ?? [];
        const canComment = Boolean(filePath && onAddComment && (line.kind === "added" || line.kind === "removed"));
        const isComposerOpen = composerLineIndex === line.index;
        const isRangeStart = rangeStartIndex === line.index;
        const rowHighlightClass = isRangeStart
          ? "bg-accent/15 ring-1 ring-accent/40"
          : isComposerOpen
            ? "bg-surface/45 ring-1 ring-surface"
            : rangeStartIndex !== null
              ? "hover:bg-accent/10"
              : "hover:bg-surface/35";

        const renderedLineText = line.text === "" ? " " : line.text;

        return (
          <div key={line.index}>
            <div className={`group/line flex w-full items-start gap-2 px-2 rounded transition-colors ${rowHighlightClass}`}>
              <div
                className={`flex-1 px-1 whitespace-pre ${getDiffLineClass(line.text)}`}
              >
                {renderedLineText}
              </div>
              {canComment && (
                <div
                  className={`flex shrink-0 items-center gap-1 transition-opacity ${
                    isComposerOpen || isRangeStart ? "opacity-100" : "opacity-0 group-hover/line:opacity-100"
                  }`}
                >
                  <Button
                    type="button"
                    className="text-[10px] text-subtext hover:text-text"
                    onClick={() => openSingleComposer(line)}
                    variant="ghost"
                    size="xs"
                  >
                    Single
                  </Button>
                  {rangeStartIndex === null ? (
                    <Button
                      type="button"
                      className="text-[10px] text-subtext hover:text-text"
                      onClick={() => setRangeStartIndex(line.index)}
                      variant="ghost"
                      size="xs"
                    >
                      Range Start
                    </Button>
                  ) : isRangeStart ? (
                    <>
                      <Button
                        type="button"
                        className="text-[10px] text-subtext hover:text-text"
                        onClick={() => openRangeComposer(rangeStartIndex, line.index)}
                        variant="ghost"
                        size="xs"
                      >
                        Range End
                      </Button>
                      <Button
                        type="button"
                        className="text-[10px] text-subtext hover:text-text"
                        onClick={() => setRangeStartIndex(null)}
                        variant="ghost"
                        size="xs"
                      >
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <Button
                      type="button"
                      className="text-[10px] text-subtext hover:text-text"
                      onClick={() => openRangeComposer(rangeStartIndex, line.index)}
                      variant="ghost"
                      size="xs"
                    >
                      Range End
                    </Button>
                  )}
                </div>
              )}
            </div>
            {lineComments.length > 0 && (
              <div className="ml-6 mb-1 space-y-1">
                {lineComments.map((comment) => (
                  <div
                    key={comment.id}
                    className="px-2 py-1 rounded bg-surface text-[10px] text-subtext break-words"
                  >
                    <span className="text-text/80 mr-1">[{buildAnchorLabel(comment.anchor)}]</span>
                    {comment.message}
                  </div>
                ))}
              </div>
            )}
            {isComposerOpen && canComment && filePath && composerAnchor && (
              <div className="ml-6 mb-2 mr-3 border border-surface rounded p-2 bg-main/60">
                <Textarea
                  rows={3}
                  value={composerText}
                  onChange={(event) => setComposerText(event.target.value)}
                  className="px-2 py-1 text-[11px]"
                  placeholder={composerAnchor.lineKind === "range"
                    ? "Add comment for selected range..."
                    : "Add comment for this line..."}
                />
                <div className="mt-2 flex items-center justify-end gap-2">
                  <Button
                    type="button"
                    className="text-[10px] text-subtext hover:text-text"
                    onClick={() => {
                      setComposerLineIndex(null);
                      setComposerText("");
                      setComposerAnchor(null);
                    }}
                    variant="ghost"
                    size="xs"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    className="px-2 py-1 text-[10px] bg-primary text-primary-foreground rounded disabled:opacity-50"
                    disabled={!composerText.trim()}
                    onClick={() => {
                      if (!onAddComment || !composerText.trim() || !composerAnchor) {
                        return;
                      }
                      onAddComment(composerAnchor, composerText.trim());
                      setComposerLineIndex(null);
                      setComposerText("");
                      setComposerAnchor(null);
                    }}
                    variant="primary"
                    size="xs"
                  >
                    Add
                  </Button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function QuickEditDrawer({
  isOpen,
  filePath,
  projectRootPath = null,
  content,
  editorTheme = DEFAULT_EDITOR_THEME,
  diff = null,
  diffLoading = false,
  diffError = null,
  diffMode = "working",
  reviewComments = [],
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
  onAddDiffComment,
}: QuickEditDrawerProps) {
  const shouldReduceMotion = useReducedMotion();
  const tabIdPrefix = useId();
  const [activeTab, setActiveTab] = useState<"diff" | "edit" | "view">(defaultTab);
  const canEdit = allowEdit && !isReadOnly;
  const hasDiffState = diff !== null || diffLoading || diffError !== null;
  const isMarkdownFile = filePath?.match(/\.(?:md|mdx|markdown)$/i) !== null;
  const showTabBar = (canEdit && hasDiffState) || isMarkdownFile;
  const diffTabId = `${tabIdPrefix}-diff-tab`;
  const editTabId = `${tabIdPrefix}-edit-tab`;
  const viewTabId = `${tabIdPrefix}-view-tab`;
  const diffPanelId = `${tabIdPrefix}-diff-panel`;
  const editPanelId = `${tabIdPrefix}-edit-panel`;
  const viewPanelId = `${tabIdPrefix}-view-panel`;

  useEffect(() => {
    if (!allowEdit && defaultTab === "edit") {
      setActiveTab("diff");
      return;
    }
    setActiveTab(defaultTab);
  }, [defaultTab, filePath, allowEdit]);
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
  const contentVariantKey = `${contentKey}-${activeTab}`;

  return (
    <QuickEditDrawerPresentational>
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
                {allowEdit && (
                  <ToolbarButton
                    onClick={onSave}
                    disabled={isSaving || isLoading || isReadOnly || !filePath}
                  >
                    {isSaving ? "Saving..." : "Save"}
                  </ToolbarButton>
                )}
                <ToolbarButton
                  onClick={onClose}
                >
                  Close
                </ToolbarButton>
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
                {isMarkdownFile && (
                  <TabButton
                    active={activeTab === "view"}
                    role="tab"
                    id={viewTabId}
                    aria-selected={activeTab === "view"}
                    aria-controls={viewPanelId}
                    tabIndex={activeTab === "view" ? 0 : -1}
                    onClick={() => setActiveTab("view")}
                  >
                    View
                  </TabButton>
                )}
              </div>
            )}
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
                {activeTab === "view" && isMarkdownFile ? (
                  <motion.div
                    key="view"
                    className="h-full w-full overflow-auto"
                    role={showTabBar ? "tabpanel" : undefined}
                    id={showTabBar ? viewPanelId : undefined}
                    aria-labelledby={showTabBar ? viewTabId : undefined}
                    variants={contentVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    transition={contentTransition}
                  >
                    <div className="px-6 py-4">
                      <Markdown content={content} />
                    </div>
                  </motion.div>
                ) : activeTab === "diff" && hasDiffState ? (
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
                      filePath={filePath}
                      diff={diff?.text ?? null}
                      mode={diffMode}
                      reviewComments={reviewComments}
                      onAddComment={onAddDiffComment}
                      isBinary={diff?.isBinary ?? false}
                      isLoading={diffLoading}
                      error={diffError}
                    />
                  </motion.div>
                ) : isLoading ? (
                  <motion.div
                    key="loading"
                    className="h-full flex items-center justify-center text-sm text-subtext"
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
    </QuickEditDrawerPresentational>
  );
}

export default QuickEditDrawer;
