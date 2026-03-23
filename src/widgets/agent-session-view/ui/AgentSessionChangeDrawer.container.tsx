import { useEffect, useId, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  CodeEditorCore,
  DEFAULT_EDITOR_THEME,
  EmptyState,
  FAST_EASE_OUT,
  LoadingSpinner,
  Markdown,
  SOFT_SPRING,
  TabButton,
  ToolbarButton,
  UnifiedDiffViewer,
  getContentSwapVariants,
  getSlideUpVariants,
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
                  <UnifiedDiffViewer
                    diff={diff?.text ?? null}
                    isBinary={diff?.isBinary ?? false}
                    isLoading={diffLoading}
                    error={diffError}
                    className="bg-main/20 text-[12px] leading-5"
                    plainLineClassName="px-4"
                    emptyContent={(
                      <div className="flex h-full items-center justify-center px-4">
                        <EmptyState className="text-xs">No diff available.</EmptyState>
                      </div>
                    )}
                    errorContent={(message) => (
                      <div className="flex h-full items-center justify-center px-6 text-center text-sm text-red-300/90">
                        {message}
                      </div>
                    )}
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
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default AgentSessionChangeDrawer;
