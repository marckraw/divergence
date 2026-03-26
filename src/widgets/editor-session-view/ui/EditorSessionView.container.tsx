import { useEffect, useId, useMemo, useRef } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { EditorSession } from "../../../entities";
import {
  CodeEditorCore,
  DEFAULT_EDITOR_THEME,
  DocumentPanelBannerStack,
  DocumentPanelHeader,
  DocumentPanelShell,
  DocumentPanelTabs,
  FAST_EASE_OUT,
  LoadingSpinner,
  Markdown,
  SOFT_SPRING,
  ToolbarButton,
  UnifiedDiffViewer,
  getContentSwapVariants,
  type EditorThemeId,
} from "../../../shared";

interface EditorSessionViewState {
  preferredTab: "edit" | "diff";
  diffMode: "working" | "branch" | null;
  changeEntry: unknown;
  focusLine: number | null;
  focusColumn: number | null;
  requestKey: number;
}

interface EditorSessionRuntimeState {
  content: string;
  initialContent: string;
  fileLoadError: string | null;
  fileSaveError: string | null;
  isLoadingFile: boolean;
  isSavingFile: boolean;
  isReadOnly: boolean;
  isDeleted: boolean;
  largeFileWarning: string | null;
  diff: {
    text: string;
    isBinary: boolean;
  } | null;
  diffMode: "working" | "branch" | null;
  diffLoading: boolean;
  diffError: string | null;
  activeTab: "edit" | "diff" | "view";
  isLoaded: boolean;
}

interface EditorSessionViewProps {
  session: EditorSession;
  state: EditorSessionRuntimeState | null;
  viewState: EditorSessionViewState | null;
  editorTheme?: EditorThemeId;
  onEnsureLoaded: (sessionId: string, options?: { force?: boolean }) => Promise<void>;
  onApplyViewState: (sessionId: string, viewState: EditorSessionViewState) => Promise<void>;
  onSetActiveTab: (
    sessionId: string,
    activeTab: EditorSessionRuntimeState["activeTab"],
  ) => void;
  onChangeContent: (sessionId: string, next: string) => void;
  onSave: (sessionId: string) => Promise<void>;
  onClose: (sessionId: string) => void;
}

function EditorSessionView({
  session,
  state,
  viewState,
  editorTheme = DEFAULT_EDITOR_THEME,
  onEnsureLoaded,
  onApplyViewState,
  onSetActiveTab,
  onChangeContent,
  onSave,
  onClose,
}: EditorSessionViewProps) {
  const shouldReduceMotion = useReducedMotion();
  const tabIdPrefix = useId();
  const lastAppliedRequestKeyRef = useRef<number | null>(null);
  const resolvedState = state ?? {
    content: "",
    initialContent: "",
    fileLoadError: null,
    fileSaveError: null,
    isLoadingFile: true,
    isSavingFile: false,
    isReadOnly: false,
    isDeleted: false,
    largeFileWarning: null,
    diff: null,
    diffMode: null,
    diffLoading: false,
    diffError: null,
    activeTab: "edit" as const,
    isLoaded: false,
  };
  const canEdit = !resolvedState.isReadOnly && !resolvedState.isDeleted;
  const hasDiffState = resolvedState.diff !== null || resolvedState.diffLoading || resolvedState.diffError !== null;
  const isMarkdownFile = session.filePath.match(/\.(?:md|mdx|markdown)$/i) !== null;
  const showTabBar = hasDiffState || isMarkdownFile;
  const diffTabId = `${tabIdPrefix}-diff-tab`;
  const editTabId = `${tabIdPrefix}-edit-tab`;
  const viewTabId = `${tabIdPrefix}-view-tab`;
  const diffPanelId = `${tabIdPrefix}-diff-panel`;
  const editPanelId = `${tabIdPrefix}-edit-panel`;
  const viewPanelId = `${tabIdPrefix}-view-panel`;
  const drawerTransition = shouldReduceMotion ? FAST_EASE_OUT : SOFT_SPRING;
  const contentVariants = useMemo(
    () => getContentSwapVariants(shouldReduceMotion),
    [shouldReduceMotion],
  );
  const contentTransition = shouldReduceMotion
    ? FAST_EASE_OUT
    : { type: "spring", stiffness: 240, damping: 30, mass: 0.8 };
  const contentVariantKey = `${session.id}-${resolvedState.activeTab}`;
  const shouldShowLoadingState = !resolvedState.isLoaded
    && resolvedState.fileLoadError === null
    && !resolvedState.isDeleted;
  const activeTab = resolvedState.activeTab === "diff" && !hasDiffState
    ? "edit"
    : resolvedState.activeTab;
  const tabItems = [
    hasDiffState
      ? {
          id: diffTabId,
          panelId: diffPanelId,
          label: "Diff",
          active: activeTab === "diff",
          onClick: () => onSetActiveTab(session.id, "diff"),
        }
      : null,
    {
      id: editTabId,
      panelId: editPanelId,
      label: "Edit",
      active: activeTab === "edit",
      onClick: () => onSetActiveTab(session.id, "edit"),
    },
    isMarkdownFile
      ? {
          id: viewTabId,
          panelId: viewPanelId,
          label: "View",
          active: activeTab === "view",
          onClick: () => onSetActiveTab(session.id, "view"),
        }
      : null,
  ].filter((item): item is NonNullable<typeof item> => item !== null);
  const bannerItems = [
    resolvedState.largeFileWarning
      ? {
          id: "large-file-warning",
          tone: "warning" as const,
          message: resolvedState.largeFileWarning,
        }
      : null,
    resolvedState.fileLoadError
      ? {
          id: "load-error",
          tone: "error" as const,
          message: resolvedState.fileLoadError,
          action: (
            <ToolbarButton
              onClick={() => {
                void onEnsureLoaded(session.id, { force: true });
              }}
              disabled={resolvedState.isLoadingFile}
            >
              Retry
            </ToolbarButton>
          ),
        }
      : null,
    resolvedState.fileSaveError
      ? {
          id: "save-error",
          tone: "error" as const,
          message: resolvedState.fileSaveError,
        }
      : null,
  ].filter((item): item is NonNullable<typeof item> => item !== null);

  useEffect(() => {
    lastAppliedRequestKeyRef.current = null;
    void onEnsureLoaded(session.id);
  }, [onEnsureLoaded, session.id]);

  useEffect(() => {
    if (!viewState || viewState.requestKey === lastAppliedRequestKeyRef.current) {
      return;
    }

    lastAppliedRequestKeyRef.current = viewState.requestKey;
    void onApplyViewState(session.id, viewState);
  }, [onApplyViewState, session.id, viewState]);

  return (
    <DocumentPanelShell
      className="bg-main"
      data-editor-root="true"
      header={(
        <DocumentPanelHeader
          eyebrow="Editor Session"
          title={session.filePath}
          titleSuffix={
            session.status === "active" ? (
              <span className="text-accent"> *</span>
            ) : null
          }
          actions={(
            <>
              {resolvedState.isReadOnly ? (
                <span className="rounded bg-surface px-2 py-1 text-[10px] text-subtext">
                  Read-only
                </span>
              ) : null}
              <ToolbarButton
                onClick={() => {
                  void onSave(session.id);
                }}
                disabled={
                  !canEdit ||
                  resolvedState.isSavingFile ||
                  resolvedState.isLoadingFile
                }
              >
                {resolvedState.isSavingFile ? "Saving..." : "Save"}
              </ToolbarButton>
              <ToolbarButton onClick={() => onClose(session.id)}>
                Close
              </ToolbarButton>
            </>
          )}
        />
      )}
      tabs={
        showTabBar ? (
          <DocumentPanelTabs
            ariaLabel="Editor session tabs"
            items={tabItems}
          />
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
                <Markdown content={resolvedState.content} />
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
                diff={resolvedState.diff?.text ?? null}
                isBinary={resolvedState.diff?.isBinary ?? false}
                isLoading={resolvedState.diffLoading}
                error={resolvedState.diffError}
                className="text-[11px] leading-5"
              />
            </motion.div>
          ) : shouldShowLoadingState ? (
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
              transition={drawerTransition}
            >
              <CodeEditorCore
                filePath={session.filePath}
                content={resolvedState.content}
                editorTheme={editorTheme}
                projectRootPath={session.path}
                isReadOnly={!canEdit}
                revealRequest={viewState?.focusLine
                  ? {
                      requestKey: viewState.requestKey,
                      line: viewState.focusLine,
                      column: viewState.focusColumn,
                    }
                  : null}
                onChange={(next) => onChangeContent(session.id, next)}
                onSave={() => { void onSave(session.id); }}
                onClose={() => onClose(session.id)}
              />
            </motion.div>
          )}
        </AnimatePresence>
    </DocumentPanelShell>
  );
}

export default EditorSessionView;
