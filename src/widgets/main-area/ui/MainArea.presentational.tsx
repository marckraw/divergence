import { useMemo } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import ProjectSettingsPanel from "./ProjectSettingsPanel.container";
import FileExplorer from "./FileExplorer.container";
import ChangesPanel from "./ChangesPanel.container";
import TmuxPanel from "./TmuxPanel.container";
import QuickEditDrawer from "./QuickEditDrawer.container";
import FileQuickSwitcher from "../../../features/file-quick-switcher";
import { ReviewDraftPanel } from "../../../features/diff-review";
import { PromptQueuePanel } from "../../../features/prompt-queue";
import { LinearTaskQueuePanel } from "../../../features/linear-task-queue";
import { FAST_EASE_OUT, SOFT_SPRING, getContentSwapVariants } from "../../../shared";
import { IconButton, Kbd, TabButton, ToolbarButton } from "../../../shared";
import { UsageLimitsButton } from "../../../features/usage-limits";
import type { MainAreaPresentationalProps } from "./MainArea.types";

function MainAreaPresentational({
  projects,
  activeSession,
  idleAttentionSessionIds,
  onCloseSession,
  onCloseSessionAndKillTmux,
  onSelectSession,
  onProjectSettingsSaved,
  onSplitSession,
  onResetSplitSession,
  onReconnectSession,
  globalTmuxHistoryLimit,
  editorTheme,
  divergencesByProject,
  projectsLoading,
  divergencesLoading,
  showFileQuickSwitcher,
  onCloseFileQuickSwitcher,
  isSidebarOpen,
  onToggleSidebar,
  isRightPanelOpen,
  onToggleRightPanel,
  sessionList,
  activeProject,
  activeSplit,
  activeRootPath,
  rightPanelTab,
  openFilePath,
  openFileContent,
  openDiff,
  diffLoading,
  diffError,
  drawerTab,
  allowEdit,
  isDrawerOpen,
  isDirty,
  isSavingFile,
  isLoadingFile,
  isReadOnly,
  fileLoadError,
  fileSaveError,
  largeFileWarning,
  changesMode,
  reviewComments,
  reviewFinalComment,
  reviewAgent,
  reviewRunning,
  reviewError,
  onOpenFile,
  onRemoveFile,
  onOpenChange,
  onCloseDrawer,
  onSaveFile,
  onChangeFileContent,
  onRightPanelTabChange,
  onChangesModeChange,
  onReviewRemoveComment,
  onReviewFinalCommentChange,
  onReviewAgentChange,
  onRunReviewAgent,
  onClearReviewDraft,
  onAddDiffComment,
  openFileReviewComments,
  queueItems,
  queueDraft,
  queueLoading,
  queueError,
  queueingPrompt,
  queueActionItemId,
  queueSendingItemId,
  onQueueDraftChange,
  onQueuePrompt,
  onQueueSendItem,
  onQueueRemoveItem,
  onQueueClear,
  linearProjectName,
  linearIssues,
  linearTotalIssueCount,
  linearLoading,
  linearRefreshing,
  linearError,
  linearInfoMessage,
  linearSendingIssueId,
  linearStatusFilter,
  linearSearchQuery,
  onLinearRefresh,
  onLinearStatusFilterChange,
  onLinearSearchQueryChange,
  onLinearSendIssue,
  linearWorkflowStates,
  linearUpdatingIssueId,
  linearStatePickerOpenIssueId,
  onLinearToggleStatePicker,
  onLinearUpdateIssueState,
  renderSession,
}: MainAreaPresentationalProps) {
  const shouldReduceMotion = useReducedMotion();
  const tabTransition = shouldReduceMotion ? FAST_EASE_OUT : SOFT_SPRING;
  const panelVariants = useMemo(
    () => getContentSwapVariants(shouldReduceMotion),
    [shouldReduceMotion]
  );
  const panelTransition = shouldReduceMotion
    ? FAST_EASE_OUT
    : { type: "spring", stiffness: 240, damping: 28, mass: 0.9 };
  const activePaneCount = activeSplit?.paneIds.length ?? 1;
  const canAddSplitPane = Boolean(activeSession) && activePaneCount < 3;

  return (
    <main className="flex-1 min-w-0 h-full bg-main flex flex-col relative">
      <div className="h-10 bg-sidebar border-b border-surface flex items-center px-2 gap-1">
        <ToolbarButton
          iconOnly
          onClick={onToggleSidebar}
          title={isSidebarOpen ? "Hide sidebar (Cmd+B)" : "Show sidebar (Cmd+B)"}
          aria-pressed={isSidebarOpen}
          aria-label="Toggle sidebar"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 5h16a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V7a2 2 0 012-2z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5v14"
            />
          </svg>
        </ToolbarButton>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1 overflow-x-auto whitespace-nowrap">
            {sessionList.length === 0 ? (
              <span className="text-xs text-subtext">No terminal open</span>
            ) : (
              sessionList.map((session, index) => (
                (() => {
                  const isActive = session.id === activeSession?.id;
                  const needsAttention = idleAttentionSessionIds.has(session.id) && !isActive;
                  return (
                    <motion.div
                      key={session.id}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded cursor-pointer text-sm transition-colors ${
                        isActive
                          ? "bg-main text-text"
                          : needsAttention
                            ? "bg-yellow/10 text-text ring-1 ring-yellow/50 shadow-[0_0_0_1px_rgba(255,200,0,0.18)] hover:bg-yellow/15"
                            : "text-subtext hover:text-text hover:bg-surface/50"
                      }`}
                      onClick={() => onSelectSession(session.id)}
                      layout={shouldReduceMotion ? undefined : "position"}
                      transition={tabTransition}
                    >
                      <span className="text-xs text-subtext">{index + 1}</span>

                      <div
                        className={`w-2 h-2 rounded-full transition-colors ${
                          needsAttention
                            ? "bg-yellow animate-pulse"
                            : session.status === "busy"
                              ? "bg-yellow animate-pulse"
                              : session.status === "active"
                                ? "bg-accent"
                                : "bg-subtext/50"
                        }`}
                      />

                      {session.type === "divergence" ? (
                        <svg
                          className="w-3 h-3 text-accent"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                          />
                        </svg>
                      ) : (
                        <svg
                          className="w-3 h-3"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                          />
                        </svg>
                      )}

                      <span className="truncate max-w-32">{session.name}</span>

                      {needsAttention && (
                        <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-yellow/20 text-yellow border border-yellow/40">
                          ready
                        </span>
                      )}

                      {session.useTmux && (
                        <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-surface text-subtext">
                          tmux
                        </span>
                      )}

                      <IconButton
                        className="w-4 h-4 text-subtext hover:text-red rounded"
                        onClick={(event) => {
                          event.stopPropagation();
                          onCloseSession(session.id);
                        }}
                        variant="ghost"
                        size="xs"
                        label={`Close session ${session.name}`}
                        icon={(
                          <svg
                            className="w-3 h-3"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M6 18L18 6M6 6l12 12"
                            />
                          </svg>
                        )}
                      />
                    </motion.div>
                  );
                })()
              ))
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 ml-2">
          <ToolbarButton
            onClick={() => activeSession && onSplitSession(activeSession.id, "vertical")}
            disabled={!canAddSplitPane}
            title="Split side-by-side (Cmd+D)"
          >
            Split V
          </ToolbarButton>
          <ToolbarButton
            onClick={() => activeSession && onSplitSession(activeSession.id, "horizontal")}
            disabled={!canAddSplitPane}
            title="Split top/bottom (Cmd+Shift+D)"
          >
            Split H
          </ToolbarButton>
          <ToolbarButton
            onClick={() => activeSession && onResetSplitSession(activeSession.id)}
            disabled={!activeSession || !activeSplit}
            title="Close split"
          >
            Single
          </ToolbarButton>
          <ToolbarButton
            onClick={() => activeSession && onReconnectSession(activeSession.id)}
            disabled={!activeSession}
            title="Reconnect tmux session (Cmd+Shift+R)"
          >
            Reconnect
          </ToolbarButton>
          <UsageLimitsButton />
          <ToolbarButton
            iconOnly
            onClick={onToggleRightPanel}
            title={isRightPanelOpen ? "Hide right panel (Cmd+Shift+B)" : "Show right panel (Cmd+Shift+B)"}
            aria-pressed={isRightPanelOpen}
            aria-label="Toggle right panel"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 5h16a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V7a2 2 0 012-2z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
              d="M15 5v14"
              />
            </svg>
          </ToolbarButton>
        </div>
      </div>

      <div className="flex-1 relative overflow-hidden min-h-0">
        {activeSession ? (
          <div className="flex h-full w-full min-h-0">
            <div className="flex-1 relative overflow-hidden min-h-0">
              {renderSession(activeSession)}
            </div>
            <div
              className={`shrink-0 overflow-hidden transition-[width] duration-200 ease-out ${
                isRightPanelOpen ? "w-96" : "w-0"
              }`}
            >
              <div
                className={`w-96 h-full bg-sidebar flex flex-col ${
                  isRightPanelOpen ? "border-l border-surface" : ""
                }`}
              >
                <div className="flex items-center border-b border-surface">
                  <div className="flex flex-1">
                    <TabButton
                      active={rightPanelTab === "settings"}
                      onClick={() => onRightPanelTabChange("settings")}
                    >
                      Settings
                    </TabButton>
                    <TabButton
                      active={rightPanelTab === "files"}
                      onClick={() => onRightPanelTabChange("files")}
                    >
                      Files
                    </TabButton>
                    <TabButton
                      active={rightPanelTab === "changes"}
                      onClick={() => onRightPanelTabChange("changes")}
                    >
                      Changes
                    </TabButton>
                    <TabButton
                      active={rightPanelTab === "queue"}
                      onClick={() => onRightPanelTabChange("queue")}
                    >
                      Queue
                    </TabButton>
                    <TabButton
                      active={rightPanelTab === "linear"}
                      onClick={() => onRightPanelTabChange("linear")}
                    >
                      Linear
                    </TabButton>
                    <TabButton
                      active={rightPanelTab === "tmux"}
                      onClick={() => onRightPanelTabChange("tmux")}
                    >
                      Tmux
                    </TabButton>
                    <TabButton
                      active={rightPanelTab === "review"}
                      onClick={() => onRightPanelTabChange("review")}
                    >
                      Review
                    </TabButton>
                  </div>
                </div>
                <div className="flex-1 min-h-0 overflow-hidden">
                  <AnimatePresence mode="wait" initial={false}>
                    {rightPanelTab === "settings" ? (
                      <motion.div
                        key="settings"
                        className="h-full"
                        variants={panelVariants}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        transition={panelTransition}
                      >
                        {activeSession.type === "workspace" || activeSession.type === "workspace_divergence" ? (
                          <div className="h-full p-4 text-sm text-subtext">
                            Workspace sessions use workspace-level settings. Open workspace settings from the sidebar
                            context menu to manage port defaults and metadata.
                          </div>
                        ) : (
                          <ProjectSettingsPanel
                            project={activeProject}
                            globalTmuxHistoryLimit={globalTmuxHistoryLimit}
                            onSaved={onProjectSettingsSaved}
                            contextPath={activeRootPath}
                            contextLabel={activeSession.type === "divergence" ? "Divergence" : "Project"}
                          />
                        )}
                      </motion.div>
                    ) : rightPanelTab === "files" ? (
                      <motion.div
                        key="files"
                        className="h-full"
                        variants={panelVariants}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        transition={panelTransition}
                      >
                        <FileExplorer
                          rootPath={activeRootPath}
                          activeFilePath={openFilePath}
                          onOpenFile={onOpenFile}
                          onRemoveFile={onRemoveFile}
                        />
                      </motion.div>
                    ) : rightPanelTab === "changes" ? (
                      <motion.div
                        key="changes"
                        className="h-full"
                        variants={panelVariants}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        transition={panelTransition}
                      >
                        <ChangesPanel
                          rootPath={activeRootPath}
                          activeFilePath={openFilePath}
                          mode={changesMode}
                          onModeChange={onChangesModeChange}
                          onOpenChange={onOpenChange}
                        />
                      </motion.div>
                    ) : rightPanelTab === "review" ? (
                      <motion.div
                        key="review"
                        className="h-full"
                        variants={panelVariants}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        transition={panelTransition}
                      >
                        <ReviewDraftPanel
                          workspacePath={activeRootPath}
                          comments={reviewComments}
                          finalComment={reviewFinalComment}
                          selectedAgent={reviewAgent}
                          isRunning={reviewRunning}
                          error={reviewError}
                          onRemoveComment={onReviewRemoveComment}
                          onFinalCommentChange={onReviewFinalCommentChange}
                          onAgentChange={onReviewAgentChange}
                          onRun={onRunReviewAgent}
                          onClear={onClearReviewDraft}
                        />
                      </motion.div>
                    ) : rightPanelTab === "queue" ? (
                      <motion.div
                        key="queue"
                        className="h-full"
                        variants={panelVariants}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        transition={panelTransition}
                      >
                        <PromptQueuePanel
                          items={queueItems}
                          draft={queueDraft}
                          loading={queueLoading}
                          error={queueError}
                          queueing={queueingPrompt}
                          actionItemId={queueActionItemId}
                          sendingItemId={queueSendingItemId}
                          onDraftChange={onQueueDraftChange}
                          onQueuePrompt={onQueuePrompt}
                          onSendItem={onQueueSendItem}
                          onRemoveItem={onQueueRemoveItem}
                          onClear={onQueueClear}
                        />
                      </motion.div>
                    ) : rightPanelTab === "linear" ? (
                      <motion.div
                        key="linear"
                        className="h-full"
                        variants={panelVariants}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        transition={panelTransition}
                      >
                        <LinearTaskQueuePanel
                          projectName={linearProjectName}
                          items={linearIssues}
                          totalCount={linearTotalIssueCount}
                          loading={linearLoading}
                          refreshing={linearRefreshing}
                          error={linearError}
                          infoMessage={linearInfoMessage}
                          sendingItemId={linearSendingIssueId}
                          statusFilter={linearStatusFilter}
                          searchQuery={linearSearchQuery}
                          workflowStates={linearWorkflowStates}
                          updatingIssueId={linearUpdatingIssueId}
                          statePickerOpenIssueId={linearStatePickerOpenIssueId}
                          onToggleStatePicker={onLinearToggleStatePicker}
                          onRefresh={onLinearRefresh}
                          onStatusFilterChange={onLinearStatusFilterChange}
                          onSearchQueryChange={onLinearSearchQueryChange}
                          onSendItem={onLinearSendIssue}
                          onUpdateIssueState={onLinearUpdateIssueState}
                        />
                      </motion.div>
                    ) : (
                      <motion.div
                        key="tmux"
                        className="h-full"
                        variants={panelVariants}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        transition={panelTransition}
                      >
                        <TmuxPanel
                          projects={projects}
                          divergencesByProject={divergencesByProject}
                          projectsLoading={projectsLoading}
                          divergencesLoading={divergencesLoading}
                          appSessions={sessionList}
                          onCloseSessionAndKillTmux={onCloseSessionAndKillTmux}
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 h-full flex items-center justify-center">
            <div className="text-center text-subtext">
              <svg
                className="w-16 h-16 mx-auto mb-4 opacity-50"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              <p className="text-lg">Select a project to start</p>
              <p className="text-sm mt-2">
                Each project gets its own terminal running Claude Code
              </p>
              <p className="text-xs mt-4 text-subtext/70">
                Press <Kbd>⌘K</Kbd> to quick switch
              </p>
            </div>
          </div>
        )}
      </div>
      <QuickEditDrawer
        isOpen={isDrawerOpen}
        filePath={openFilePath}
        projectRootPath={activeRootPath}
        content={openFileContent}
        editorTheme={editorTheme}
        diff={openDiff}
        diffLoading={diffLoading}
        diffError={diffError}
        diffMode={changesMode}
        reviewComments={openFileReviewComments}
        onAddDiffComment={onAddDiffComment}
        defaultTab={drawerTab}
        allowEdit={allowEdit}
        isDirty={isDirty}
        isSaving={isSavingFile}
        isLoading={isLoadingFile}
        isReadOnly={isReadOnly}
        loadError={fileLoadError}
        saveError={fileSaveError}
        largeFileWarning={largeFileWarning}
        onChange={onChangeFileContent}
        onSave={onSaveFile}
        onClose={onCloseDrawer}
      />
      <AnimatePresence>
        {showFileQuickSwitcher && activeRootPath && (
          <FileQuickSwitcher
            rootPath={activeRootPath}
            onSelect={(path) => {
              onOpenFile(path);
              onCloseFileQuickSwitcher();
            }}
            onClose={onCloseFileQuickSwitcher}
          />
        )}
      </AnimatePresence>
    </main>
  );
}

export default MainAreaPresentational;
