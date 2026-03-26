import { useEffect, useId, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  CodeEditorCore,
  DEFAULT_EDITOR_THEME,
  DocumentPanelBannerStack,
  DocumentPanelHeader,
  DocumentPanelShell,
  DocumentPanelTabs,
  EmptyState,
  FAST_EASE_OUT,
  LoadingSpinner,
  Markdown,
  SOFT_SPRING,
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
          </DocumentPanelShell>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default AgentSessionChangeDrawer;
