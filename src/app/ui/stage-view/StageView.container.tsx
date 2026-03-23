import {
  createRef,
  useCallback,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type RefObject,
} from "react";
import type {
  AgentProvider,
  Divergence,
  Project,
  SplitSessionState,
  StageLayout,
  StageLayoutOrientation,
  StagePaneId,
  StageTab,
  StageTabId,
  TerminalSession,
  WorkspaceMember,
  WorkspaceSession,
} from "../../../entities";
import {
  MAX_STAGE_PANES,
  getFocusedPane,
  isAgentSession,
  isEditorSession,
  isTerminalSession,
  type StagePaneRef,
} from "../../../entities";
import type {
  AgentRuntimeAttachment,
  AgentRuntimeCapabilities,
  AgentRuntimeEffort,
  AgentRuntimeInteractionMode,
  AppSettings,
  EditorThemeId,
} from "../../../shared";
import { ToolbarButton } from "../../../shared";
import { UsageLimitsButton } from "../../../features/usage-limits";
import StageTabBar from "../../../widgets/stage-tab-bar";
import WorkspaceSessionTabsPresentational from "../../../widgets/workspace-session-tabs";
import type { AgentSessionComposerHandle } from "../../../widgets/agent-session-view/ui/AgentSessionView.types";
import AgentStagePane from "./AgentStagePane.container";
import EditorStagePane from "./EditorStagePane.container";
import PendingStagePane from "./PendingStagePane.container";
import StageSidebar from "./StageSidebar.container";
import TerminalStagePane from "./TerminalStagePane.container";
import type {
  EditorSessionRuntimeState,
  EditorSessionViewState,
} from "../../model/useEditorSessionManagement";
import {
  buildPendingStagePaneCreateContext,
  type PendingStagePaneCreateAction,
} from "./lib/pendingStagePane.pure";

interface StageViewProps {
  tabs: StageTab[];
  activeTabId: StageTabId | null;
  attentionTabIds: Set<StageTabId>;
  layout: StageLayout | null;
  workspaceSessions: Map<string, WorkspaceSession>;
  sessionList: WorkspaceSession[];
  activeSessionId: string | null;
  idleAttentionSessionIds: Set<string>;
  lastViewedRuntimeEventAtMsBySessionId: Map<string, number>;
  dismissedAttentionKeyBySessionId: Map<string, string>;
  projects: Project[];
  agentProviders: AgentProvider[];
  terminalSessions: TerminalSession[];
  divergencesByProject: Map<number, Divergence[]>;
  workspaceMembersByWorkspaceId: Map<number, WorkspaceMember[]>;
  splitBySessionId: Map<string, SplitSessionState>;
  reconnectBySessionId: Map<string, number>;
  globalTmuxHistoryLimit: number;
  appSettings: AppSettings;
  editorTheme: EditorThemeId;
  capabilities: AgentRuntimeCapabilities | null;
  projectsLoading: boolean;
  divergencesLoading: boolean;
  showFileQuickSwitcher: boolean;
  editorRuntimeStateBySessionId: Map<string, EditorSessionRuntimeState>;
  editorViewStateBySessionId: Map<string, EditorSessionViewState>;
  isSidebarOpen: boolean;
  isRightPanelOpen: boolean;
  onToggleSidebar: () => void;
  onToggleRightPanel: () => void;
  onCreateTab: () => void;
  onCloseTab: (tabId: StageTabId) => void;
  onCloseOtherTabs: (tabId: StageTabId) => void;
  onFocusTab: (tabId: StageTabId) => void;
  onRenameTab: (tabId: StageTabId, label: string) => void;
  onSelectSession: (sessionId: string) => void | Promise<void>;
  onDismissSessionAttention: (sessionId: string) => void;
  onCloseSession: (sessionId: string) => void;
  onCloseSessionAndKillTmux: (sessionId: string) => Promise<void>;
  onCloseFileQuickSwitcher: () => void;
  onSplitStage: (orientation: StageLayoutOrientation) => void;
  onResetToSinglePane: (sessionId?: string | null) => void;
  onFocusPane: (paneId: StagePaneId) => void;
  onReplacePaneRef: (paneId: StagePaneId, ref: StagePaneRef) => void;
  onCreatePendingSession: (paneId: StagePaneId, action: PendingStagePaneCreateAction) => void | Promise<void>;
  onClosePane: (paneId: StagePaneId) => void;
  onResizeStageAdjacentPanes: (dividerIndex: number, deltaRatio: number) => void;
  onOpenOrFocusEditorFile: (
    filePath: string,
    sourceSession: WorkspaceSession | null,
    options?: { targetPaneId?: StagePaneId | null },
  ) => void;
  onOpenOrFocusEditorChange: (
    entry: import("../../../entities").GitChangeEntry,
    mode: import("../../../entities").ChangesMode,
    sourceSession: WorkspaceSession | null,
  ) => void;
  onOpenOrFocusEditorSearchMatch: (
    filePath: string,
    lineNumber: number,
    columnStart: number,
    sourceSession: WorkspaceSession | null,
  ) => void;
  onEnsureEditorSessionLoaded: (sessionId: string, options?: { force?: boolean }) => Promise<void>;
  onApplyEditorSessionViewState: (sessionId: string, viewState: EditorSessionViewState) => Promise<void>;
  onSetEditorSessionActiveTab: (
    sessionId: string,
    activeTab: EditorSessionRuntimeState["activeTab"],
  ) => void;
  onChangeEditorSessionContent: (sessionId: string, next: string) => void;
  onSaveEditorSession: (sessionId: string) => Promise<void>;
  onStatusChange: (sessionId: string, status: TerminalSession["status"]) => void;
  onRegisterTerminalCommand: (sessionId: string, sendCommand: (command: string) => void) => void;
  onUnregisterTerminalCommand: (sessionId: string) => void;
  onFocusSplitPane: (sessionId: string, paneId: import("../../../entities").SplitPaneId) => void;
  onResizeSplitPanes: (sessionId: string, paneSizes: number[]) => void;
  onReconnectSession: (sessionId: string) => void;
  onProjectSettingsSaved: (settings: import("../../../entities/project").ProjectSettings) => void;
  onRunReviewAgentRequest: (input: {
    sourceSessionId: string;
    workspacePath: string;
    agent: import("../../../features/diff-review").DiffReviewAgent;
    briefMarkdown: string;
  }) => Promise<void>;
  onSendPromptToSession: (sessionId: string, prompt: string) => Promise<void>;
  onUpdateSessionSettings: (sessionId: string, input: {
    model?: string;
    effort?: AgentRuntimeEffort;
  }) => Promise<void>;
  onSendPrompt: (
    sessionId: string,
    prompt: string,
    options?: {
      interactionMode?: AgentRuntimeInteractionMode;
      attachments?: AgentRuntimeAttachment[];
    }
  ) => Promise<void>;
  onStageAttachment: (input: {
    sessionId: string;
    name: string;
    mimeType: string;
    base64Content: string;
  }) => Promise<AgentRuntimeAttachment>;
  onDiscardAttachment: (sessionId: string, attachmentId: string) => Promise<void>;
  onRespondToRequest: (
    sessionId: string,
    requestId: string,
    input: { decision?: string; answers?: string[] }
  ) => Promise<void>;
  onStopSession: (sessionId: string) => Promise<void>;
}

function StageView({
  tabs,
  activeTabId,
  attentionTabIds,
  layout,
  workspaceSessions,
  sessionList,
  activeSessionId,
  idleAttentionSessionIds,
  lastViewedRuntimeEventAtMsBySessionId,
  dismissedAttentionKeyBySessionId,
  projects,
  agentProviders,
  terminalSessions,
  divergencesByProject,
  workspaceMembersByWorkspaceId,
  splitBySessionId,
  reconnectBySessionId,
  globalTmuxHistoryLimit,
  appSettings,
  editorTheme,
  capabilities,
  projectsLoading,
  divergencesLoading,
  showFileQuickSwitcher,
  editorRuntimeStateBySessionId,
  editorViewStateBySessionId,
  isSidebarOpen,
  isRightPanelOpen,
  onToggleSidebar,
  onToggleRightPanel,
  onCreateTab,
  onCloseTab,
  onCloseOtherTabs,
  onFocusTab,
  onRenameTab,
  onSelectSession,
  onDismissSessionAttention,
  onCloseSession,
  onCloseSessionAndKillTmux,
  onCloseFileQuickSwitcher,
  onSplitStage,
  onResetToSinglePane,
  onFocusPane,
  onReplacePaneRef,
  onCreatePendingSession,
  onClosePane,
  onResizeStageAdjacentPanes,
  onOpenOrFocusEditorFile,
  onOpenOrFocusEditorChange,
  onOpenOrFocusEditorSearchMatch,
  onEnsureEditorSessionLoaded,
  onApplyEditorSessionViewState,
  onSetEditorSessionActiveTab,
  onChangeEditorSessionContent,
  onSaveEditorSession,
  onStatusChange,
  onRegisterTerminalCommand,
  onUnregisterTerminalCommand,
  onFocusSplitPane,
  onResizeSplitPanes,
  onReconnectSession,
  onProjectSettingsSaved,
  onRunReviewAgentRequest,
  onSendPromptToSession,
  onUpdateSessionSettings,
  onSendPrompt,
  onStageAttachment,
  onDiscardAttachment,
  onRespondToRequest,
  onStopSession,
}: StageViewProps) {
  const [isDraggingStageDivider, setIsDraggingStageDivider] = useState(false);
  const composerRefsRef = useRef(new Map<string, RefObject<AgentSessionComposerHandle>>());

  const getComposerRef = useCallback((sessionId: string) => {
    let composerRef = composerRefsRef.current.get(sessionId);
    if (!composerRef) {
      composerRef = createRef<AgentSessionComposerHandle>();
      composerRefsRef.current.set(sessionId, composerRef);
    }
    return composerRef;
  }, []);

  const focusedPane = useMemo(
    () => (layout && layout.panes.length > 0 ? getFocusedPane(layout) : null),
    [layout],
  );
  const focusedSession = useMemo(() => {
    if (!focusedPane || focusedPane.ref.kind === "pending") {
      return null;
    }
    return workspaceSessions.get(focusedPane.ref.sessionId) ?? null;
  }, [focusedPane, workspaceSessions]);
  const focusedAgentComposerRef = useMemo(() => {
    if (!focusedSession || !isAgentSession(focusedSession)) {
      return null;
    }
    return getComposerRef(focusedSession.id);
  }, [focusedSession, getComposerRef]);

  const handleStageResizeDragStart = useCallback((
    event: ReactMouseEvent<HTMLDivElement>,
    orientation: StageLayoutOrientation,
    dividerIndex: number,
  ) => {
    if (event.button !== 0) {
      return;
    }

    const container = event.currentTarget.parentElement;
    if (!container) {
      return;
    }

    const containerRect = container.getBoundingClientRect();
    const containerSize = orientation === "vertical" ? containerRect.width : containerRect.height;
    if (containerSize <= 0) {
      return;
    }

    const startPointer = orientation === "vertical" ? event.clientX : event.clientY;
    setIsDraggingStageDivider(true);
    document.body.style.userSelect = "none";
    document.body.style.cursor = orientation === "vertical" ? "col-resize" : "row-resize";

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const pointer = orientation === "vertical" ? moveEvent.clientX : moveEvent.clientY;
      const deltaRatio = (pointer - startPointer) / containerSize;
      onResizeStageAdjacentPanes(dividerIndex, deltaRatio);
    };

    const handleMouseUp = () => {
      setIsDraggingStageDivider(false);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  }, [onResizeStageAdjacentPanes]);

  const handleSelectPendingSession = useCallback((paneId: StagePaneId, sessionId: string) => {
    const session = workspaceSessions.get(sessionId);
    if (!session) {
      return;
    }

    onReplacePaneRef(
      paneId,
      isAgentSession(session)
        ? { kind: "agent", sessionId }
        : isEditorSession(session)
          ? { kind: "editor", sessionId }
          : { kind: "terminal", sessionId },
    );
  }, [onReplacePaneRef, workspaceSessions]);

  const canSplitStage = Boolean(layout && layout.panes.length < MAX_STAGE_PANES);
  const layoutOrientationClass = layout?.orientation === "horizontal" ? "flex-col" : "flex-row";
  const visibleSessionList = useMemo(() => {
    if (!layout) {
      return [];
    }

    const seenIds = new Set<string>();
    const next: WorkspaceSession[] = [];

    for (const pane of layout.panes) {
      if (pane.ref.kind === "pending" || seenIds.has(pane.ref.sessionId)) {
        continue;
      }

      const session = workspaceSessions.get(pane.ref.sessionId);
      if (!session) {
        continue;
      }

      seenIds.add(session.id);
      next.push(session);
    }

    return next;
  }, [layout, workspaceSessions]);

  const pendingPaneCreateContextByPaneId = useMemo(() => {
    const next = new Map<StagePaneId, ReturnType<typeof buildPendingStagePaneCreateContext>>();
    if (!layout) {
      return next;
    }

    for (const pane of layout.panes) {
      if (pane.ref.kind !== "pending") {
        continue;
      }

      const sourceSession = pane.ref.sourceSessionId
        ? workspaceSessions.get(pane.ref.sourceSessionId) ?? null
        : null;
      next.set(pane.id, buildPendingStagePaneCreateContext(sourceSession, agentProviders));
    }

    return next;
  }, [agentProviders, layout, workspaceSessions]);
  const pendingPaneSourceSessionByPaneId = useMemo(() => {
    const next = new Map<StagePaneId, WorkspaceSession | null>();
    if (!layout) {
      return next;
    }

    for (const pane of layout.panes) {
      if (pane.ref.kind !== "pending") {
        continue;
      }

      const sourceSession = pane.ref.sourceSessionId
        ? workspaceSessions.get(pane.ref.sourceSessionId) ?? null
        : null;
      next.set(pane.id, sourceSession);
    }

    return next;
  }, [layout, workspaceSessions]);

  return (
    <main className="flex flex-1 min-w-0 h-full bg-main flex-col">
      <StageTabBar
        tabs={tabs}
        activeTabId={activeTabId}
        attentionTabIds={attentionTabIds}
        onSelectTab={onFocusTab}
        onCreateTab={onCreateTab}
        onCloseTab={onCloseTab}
        onCloseOtherTabs={onCloseOtherTabs}
        onRenameTab={onRenameTab}
      />
      <div className="h-10 bg-sidebar border-b border-surface flex items-center px-2 gap-1">
        <ToolbarButton
          iconOnly
          onClick={onToggleSidebar}
          title={isSidebarOpen ? "Hide sidebar (Cmd+B)" : "Show sidebar (Cmd+B)"}
          aria-pressed={isSidebarOpen}
          aria-label="Toggle sidebar"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5h16a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V7a2 2 0 012-2z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5v14" />
          </svg>
        </ToolbarButton>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1 overflow-x-auto whitespace-nowrap">
            <WorkspaceSessionTabsPresentational
              sessionList={visibleSessionList}
              activeSessionId={activeSessionId}
              idleAttentionSessionIds={idleAttentionSessionIds}
              lastViewedRuntimeEventAtMsBySessionId={lastViewedRuntimeEventAtMsBySessionId}
              dismissedAttentionKeyBySessionId={dismissedAttentionKeyBySessionId}
              onSelectSession={(sessionId) => {
                void onSelectSession(sessionId);
              }}
              onDismissSessionAttention={onDismissSessionAttention}
              onCloseSession={onCloseSession}
            />
          </div>
        </div>
        <div className="ml-2 flex items-center gap-2">
          <ToolbarButton
            onClick={() => onSplitStage("vertical")}
            disabled={!canSplitStage}
            title="Split side-by-side (Cmd+D)"
          >
            Split V
          </ToolbarButton>
          <ToolbarButton
            onClick={() => onSplitStage("horizontal")}
            disabled={!canSplitStage}
            title="Split top/bottom (Cmd+Shift+D)"
          >
            Split H
          </ToolbarButton>
          <ToolbarButton
            onClick={() => onResetToSinglePane(focusedSession?.id ?? null)}
            disabled={!layout || layout.panes.length <= 1 || !focusedSession}
            title="Collapse to one pane"
          >
            Single
          </ToolbarButton>
          <ToolbarButton
            onClick={() => {
              if (focusedSession && isTerminalSession(focusedSession)) {
                onReconnectSession(focusedSession.id);
              }
            }}
            disabled={!focusedSession || !isTerminalSession(focusedSession)}
            title="Reconnect focused terminal"
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
            disabled={!focusedSession}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5h16a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V7a2 2 0 012-2z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v14" />
            </svg>
          </ToolbarButton>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex overflow-hidden">
        <div className="flex-1 min-h-0 min-w-0">
          {!layout || layout.panes.length === 0 ? (
            <div className="flex h-full items-center justify-center px-6 text-sm text-subtext">
              Open a terminal or agent session to start working.
            </div>
          ) : (
            <div className={`flex h-full w-full min-h-0 ${layoutOrientationClass}`}>
              {layout.panes.map((pane, index) => {
                const session = pane.ref.kind === "pending"
                  ? null
                  : workspaceSessions.get(pane.ref.sessionId) ?? null;
                const paneSize = layout.paneSizes[index] ?? 1 / layout.panes.length;
                const isFocused = pane.id === layout.focusedPaneId;
                const withDivider = index < layout.panes.length - 1;

                return (
                  <div key={pane.id} className="contents">
                    <div
                      className={`min-w-0 min-h-0 ${layout.orientation === "horizontal" ? "w-full" : "h-full"}`}
                      style={{
                        flexBasis: 0,
                        flexGrow: paneSize,
                        flexShrink: 1,
                      }}
                    >
                      <div
                        className={`h-full min-h-0 min-w-0 overflow-hidden ${
                          !isDraggingStageDivider ? "transition-[flex-grow] duration-150 ease-out" : ""
                        } ${
                          isFocused
                            ? "border border-accent/70 ring-1 ring-inset ring-accent/30 shadow-lg shadow-accent/10"
                            : "border border-surface/80"
                        }`}
                        onMouseDown={() => onFocusPane(pane.id)}
                      >
                        {pane.ref.kind === "pending" ? (
                          <PendingStagePane
                            sessions={sessionList}
                            sourceSession={pendingPaneSourceSessionByPaneId.get(pane.id) ?? null}
                            createContext={pendingPaneCreateContextByPaneId.get(pane.id) ?? null}
                            onSelectExistingSession={(sessionId) => handleSelectPendingSession(pane.id, sessionId)}
                            onOpenFile={(filePath, sourceSession) => {
                              onOpenOrFocusEditorFile(filePath, sourceSession, { targetPaneId: pane.id });
                            }}
                            onCreateSession={(action) => {
                              void onCreatePendingSession(pane.id, action);
                            }}
                            onClose={() => onClosePane(pane.id)}
                          />
                        ) : session && isTerminalSession(session) ? (
                          <TerminalStagePane
                            session={session}
                            isStageFocused={isFocused}
                            splitBySessionId={splitBySessionId}
                            reconnectBySessionId={reconnectBySessionId}
                            onCloseSession={onCloseSession}
                            onStatusChange={onStatusChange}
                            onRegisterTerminalCommand={onRegisterTerminalCommand}
                            onUnregisterTerminalCommand={onUnregisterTerminalCommand}
                            onFocusSplitPane={onFocusSplitPane}
                            onResizeSplitPanes={onResizeSplitPanes}
                            onReconnectSession={onReconnectSession}
                          />
                        ) : session && isAgentSession(session) ? (
                          <AgentStagePane
                            sessionId={session.id}
                            composerRef={getComposerRef(session.id)}
                            capabilities={capabilities}
                            onUpdateSessionSettings={onUpdateSessionSettings}
                            onSendPrompt={onSendPrompt}
                            onStageAttachment={onStageAttachment}
                            onDiscardAttachment={onDiscardAttachment}
                            onRespondToRequest={onRespondToRequest}
                            onStopSession={onStopSession}
                          />
                        ) : session && isEditorSession(session) ? (
                          <EditorStagePane
                            session={session}
                            state={editorRuntimeStateBySessionId.get(session.id) ?? null}
                            viewState={editorViewStateBySessionId.get(session.id) ?? null}
                            editorTheme={editorTheme}
                            onEnsureLoaded={onEnsureEditorSessionLoaded}
                            onApplyViewState={onApplyEditorSessionViewState}
                            onSetActiveTab={onSetEditorSessionActiveTab}
                            onChangeContent={onChangeEditorSessionContent}
                            onSave={onSaveEditorSession}
                            onCloseSession={onCloseSession}
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center px-6 text-sm text-subtext">
                            Session is no longer available.
                          </div>
                        )}
                      </div>
                    </div>
                    {withDivider && (
                      <div
                        className={layout.orientation === "horizontal"
                          ? "h-1 w-full shrink-0 cursor-row-resize border-t border-surface bg-transparent hover:bg-accent/30 active:bg-accent/50 transition-colors"
                          : "h-full w-1 shrink-0 cursor-col-resize border-l border-surface bg-transparent hover:bg-accent/30 active:bg-accent/50 transition-colors"
                        }
                        onMouseDown={(event) => handleStageResizeDragStart(event, layout.orientation, index)}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {isRightPanelOpen && (
          <StageSidebar
            focusedSession={focusedSession}
            terminalSessions={terminalSessions}
            projects={projects}
            divergencesByProject={divergencesByProject}
            workspaceMembersByWorkspaceId={workspaceMembersByWorkspaceId}
            splitBySessionId={splitBySessionId}
            globalTmuxHistoryLimit={globalTmuxHistoryLimit}
            appSettings={appSettings}
            editorTheme={editorTheme}
            focusedAgentComposerRef={focusedAgentComposerRef}
            projectsLoading={projectsLoading}
            divergencesLoading={divergencesLoading}
            showFileQuickSwitcher={showFileQuickSwitcher}
            onOpenOrFocusEditorFile={onOpenOrFocusEditorFile}
            onOpenOrFocusEditorChange={onOpenOrFocusEditorChange}
            onOpenOrFocusEditorSearchMatch={onOpenOrFocusEditorSearchMatch}
            onCloseFileQuickSwitcher={onCloseFileQuickSwitcher}
            onSendPromptToSession={onSendPromptToSession}
            onCloseSessionAndKillTmux={onCloseSessionAndKillTmux}
            onProjectSettingsSaved={onProjectSettingsSaved}
            onRunReviewAgentRequest={onRunReviewAgentRequest}
            onUpdateSessionSettings={onUpdateSessionSettings}
            onRespondToRequest={onRespondToRequest}
            onSendPrompt={onSendPrompt}
            onStageAttachment={onStageAttachment}
            onDiscardAttachment={onDiscardAttachment}
            onStopSession={onStopSession}
          />
        )}
      </div>
    </main>
  );
}

export default StageView;
