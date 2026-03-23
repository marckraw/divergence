import { useEffect, useId, useMemo, useRef } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { EditorSession } from "../../../entities";
import {
  CodeEditorCore,
  DEFAULT_EDITOR_THEME,
  FAST_EASE_OUT,
  LoadingSpinner,
  Markdown,
  SOFT_SPRING,
  TabButton,
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

  const activeTab = resolvedState.activeTab === "diff" && !hasDiffState
    ? "edit"
    : resolvedState.activeTab;

  return (
    <div className="flex h-full min-h-0 flex-col bg-main" data-editor-root="true">
      <div className="flex items-center justify-between gap-4 border-b border-surface px-4 py-2">
        <div className="min-w-0">
          <p className="text-xs text-subtext/70">Editor Session</p>
          <p className="truncate text-sm text-text">
            {session.filePath}
            {session.status === "active" ? <span className="text-accent"> *</span> : null}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {resolvedState.isReadOnly && (
            <span className="rounded bg-surface px-2 py-1 text-[10px] text-subtext">
              Read-only
            </span>
          )}
          <ToolbarButton
            onClick={() => { void onSave(session.id); }}
            disabled={!canEdit || resolvedState.isSavingFile || resolvedState.isLoadingFile}
          >
            {resolvedState.isSavingFile ? "Saving..." : "Save"}
          </ToolbarButton>
          <ToolbarButton onClick={() => onClose(session.id)}>
            Close
          </ToolbarButton>
        </div>
      </div>
      {showTabBar && (
        <div className="flex items-center border-b border-surface text-xs" role="tablist" aria-label="Editor session tabs">
          {hasDiffState && (
            <TabButton
              active={activeTab === "diff"}
              role="tab"
              id={diffTabId}
              aria-selected={activeTab === "diff"}
              aria-controls={diffPanelId}
              tabIndex={activeTab === "diff" ? 0 : -1}
              onClick={() => onSetActiveTab(session.id, "diff")}
            >
              Diff
            </TabButton>
          )}
          <TabButton
            active={activeTab === "edit"}
            role="tab"
            id={editTabId}
            aria-selected={activeTab === "edit"}
            aria-controls={editPanelId}
            tabIndex={activeTab === "edit" ? 0 : -1}
            onClick={() => onSetActiveTab(session.id, "edit")}
          >
            Edit
          </TabButton>
          {isMarkdownFile && (
            <TabButton
              active={activeTab === "view"}
              role="tab"
              id={viewTabId}
              aria-selected={activeTab === "view"}
              aria-controls={viewPanelId}
              tabIndex={activeTab === "view" ? 0 : -1}
              onClick={() => onSetActiveTab(session.id, "view")}
            >
              View
            </TabButton>
          )}
        </div>
      )}
      {resolvedState.largeFileWarning && (
        <div className="border-b border-yellow-400/20 bg-yellow-400/10 px-4 py-2 text-[11px] text-yellow-200/90">
          {resolvedState.largeFileWarning}
        </div>
      )}
      {resolvedState.fileLoadError && (
        <div className="border-b border-red-500/20 bg-red-500/10 px-4 py-2 text-[11px] text-red-300/90">
          {resolvedState.fileLoadError}
        </div>
      )}
      {resolvedState.fileSaveError && (
        <div className="border-b border-red-500/20 bg-red-500/10 px-4 py-2 text-[11px] text-red-300/90">
          {resolvedState.fileSaveError}
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
      </div>
    </div>
  );
}

export default EditorSessionView;
