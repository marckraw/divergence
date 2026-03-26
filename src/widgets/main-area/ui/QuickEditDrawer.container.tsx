import { useEffect, useId, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  CodeEditorCore,
  DEFAULT_EDITOR_THEME,
  DocumentPanelBannerStack,
  DocumentPanelHeader,
  DocumentPanelShell,
  DocumentPanelTabs,
  FAST_EASE_OUT,
  SOFT_SPRING,
  Button,
  LoadingSpinner,
  Markdown,
  UnifiedDiffViewer,
  getContentSwapVariants,
  getSlideUpVariants,
  parseUnifiedDiffLines,
  type EditorThemeId,
  type ParsedDiffLine,
} from "../../../shared";
import { Textarea, ToolbarButton } from "../../../shared";
import type { ChangesMode } from "../../../entities";
import {
  buildAnchorLabel,
  type DiffReviewAnchor,
  type DiffReviewComment,
} from "../../../features/diff-review";

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

function DiffViewer({
  filePath,
  diff,
  lines,
  mode,
  reviewComments,
  onAddComment,
  isBinary,
  isLoading,
  error,
}: {
  filePath: string | null;
  diff: string | null;
  lines: ParsedDiffLine[];
  mode: ChangesMode;
  reviewComments: DiffReviewComment[];
  onAddComment?: (anchor: DiffReviewAnchor, message: string) => void;
  isBinary: boolean;
  isLoading: boolean;
  error: string | null;
}) {
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

  return (
    <UnifiedDiffViewer
      diff={diff}
      lines={lines}
      isBinary={isBinary}
      isLoading={isLoading}
      error={error}
      className="text-[11px] leading-5"
      header={rangeStartIndex !== null ? (
        <div className="sticky top-0 z-10 mx-2 mb-1 mt-2 flex items-center justify-between gap-2 rounded border border-accent/30 bg-accent/10 px-2 py-1 text-[10px] text-subtext">
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
      ) : null}
      getLineRowClassName={(line) => {
        const isComposerOpen = composerLineIndex === line.index;
        const isRangeStart = rangeStartIndex === line.index;
        if (isRangeStart) {
          return "bg-accent/15 ring-1 ring-accent/40";
        }
        if (isComposerOpen) {
          return "bg-surface/45 ring-1 ring-surface";
        }
        return rangeStartIndex !== null ? "hover:bg-accent/10" : "hover:bg-surface/35";
      }}
      renderLineAside={(line) => {
        const canComment = Boolean(
          filePath && onAddComment && (line.kind === "added" || line.kind === "removed"),
        );
        if (!canComment) {
          return null;
        }

        const isComposerOpen = composerLineIndex === line.index;
        const isRangeStart = rangeStartIndex === line.index;

        return (
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
        );
      }}
      renderLineFooter={(line) => {
        const lineComments = commentsByLine.get(line.index) ?? [];
        const canComment = Boolean(
          filePath && onAddComment && (line.kind === "added" || line.kind === "removed"),
        );
        const isComposerOpen = composerLineIndex === line.index;

        return (
          <>
            {lineComments.length > 0 && (
              <div className="mb-1 ml-6 space-y-1">
                {lineComments.map((comment) => (
                  <div
                    key={comment.id}
                    className="break-words rounded bg-surface px-2 py-1 text-[10px] text-subtext"
                  >
                    <span className="mr-1 text-text/80">[{buildAnchorLabel(comment.anchor)}]</span>
                    {comment.message}
                  </div>
                ))}
              </div>
            )}
            {isComposerOpen && canComment && filePath && composerAnchor && (
              <div className="mb-2 ml-6 mr-3 rounded border border-surface bg-main/60 p-2">
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
                    className="rounded bg-primary px-2 py-1 text-[10px] text-primary-foreground disabled:opacity-50"
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
          </>
        );
      }}
    />
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
  const tabItems = [
    {
      id: diffTabId,
      panelId: diffPanelId,
      label: "Diff",
      active: activeTab === "diff",
      onClick: () => setActiveTab("diff"),
    },
    allowEdit
      ? {
          id: editTabId,
          panelId: editPanelId,
          label: "Edit",
          active: activeTab === "edit",
          onClick: () => setActiveTab("edit"),
        }
      : null,
    isMarkdownFile
      ? {
          id: viewTabId,
          panelId: viewPanelId,
          label: "View",
          active: activeTab === "view",
          onClick: () => setActiveTab("view"),
        }
      : null,
  ].filter((item): item is NonNullable<typeof item> => item !== null);
  const bannerItems = [
    largeFileWarning
      ? {
          id: "large-file-warning",
          tone: "warning" as const,
          message: largeFileWarning,
        }
      : null,
    loadError
      ? {
          id: "load-error",
          tone: "error" as const,
          message: loadError,
        }
      : null,
    saveError
      ? {
          id: "save-error",
          tone: "error" as const,
          message: saveError,
        }
      : null,
  ].filter((item): item is NonNullable<typeof item> => item !== null);
  const parsedDiffLines = useMemo(
    () => parseUnifiedDiffLines(diff?.text ?? null),
    [diff?.text],
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="absolute inset-x-0 bottom-0 flex h-[45%] flex-col border-t border-surface bg-main shadow-xl"
          data-editor-root="true"
          aria-hidden={!isOpen}
          style={{ pointerEvents: isOpen ? "auto" : "none" }}
          variants={drawerVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          transition={drawerTransition}
        >
          <DocumentPanelShell
            header={(
              <DocumentPanelHeader
                eyebrow="Quick Edit"
                title={filePath ?? "No file selected"}
                titleSuffix={isDirty ? <span className="text-accent"> *</span> : null}
                actions={(
                  <>
                    {isReadOnly ? (
                      <span className="rounded bg-surface px-2 py-1 text-[10px] text-subtext">
                        Read-only
                      </span>
                    ) : null}
                    {allowEdit ? (
                      <ToolbarButton
                        onClick={onSave}
                        disabled={isSaving || isLoading || isReadOnly || !filePath}
                      >
                        {isSaving ? "Saving..." : "Save"}
                      </ToolbarButton>
                    ) : null}
                    <ToolbarButton onClick={onClose}>Close</ToolbarButton>
                  </>
                )}
              />
            )}
            tabs={
              showTabBar ? (
                <DocumentPanelTabs ariaLabel="Quick edit tabs" items={tabItems} />
              ) : undefined
            }
            banners={
              bannerItems.length > 0 ? (
                <DocumentPanelBannerStack items={bannerItems} />
              ) : undefined
            }
          >
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
                      lines={parsedDiffLines}
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
                    <CodeEditorCore
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
          </DocumentPanelShell>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default QuickEditDrawer;
