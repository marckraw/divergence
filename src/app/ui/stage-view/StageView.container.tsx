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
  Divergence,
  Project,
  SplitSessionState,
  StageLayout,
  StageLayoutOrientation,
  StagePaneId,
  TerminalSession,
  WorkspaceMember,
  WorkspaceSession,
} from "../../../entities";
import {
  MAX_STAGE_PANES,
  getFocusedPane,
  isAgentSession,
  isTerminalSession,
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
import WorkspaceSessionTabsPresentational from "../../../widgets/workspace-session-tabs";
import type { AgentSessionComposerHandle } from "../../../widgets/agent-session-view/ui/AgentSessionView.types";
import type { CommandCenterMode } from "../../../features/command-center";
import AgentStagePane from "./AgentStagePane.container";
import PendingStagePane from "./PendingStagePane.container";
import StageSidebar from "./StageSidebar.container";
import TerminalStagePane from "./TerminalStagePane.container";

interface StageViewProps {
  layout: StageLayout | null;
  workspaceSessions: Map<string, WorkspaceSession>;
  sessionList: WorkspaceSession[];
  activeSessionId: string | null;
  idleAttentionSessionIds: Set<string>;
  lastViewedRuntimeEventAtMsBySessionId: Map<string, number>;
  dismissedAttentionKeyBySessionId: Map<string, string>;
  projects: Project[];
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
  isSidebarOpen: boolean;
  isRightPanelOpen: boolean;
  onToggleSidebar: () => void;
  onToggleRightPanel: () => void;
  onSelectSession: (sessionId: string) => void | Promise<void>;
  onDismissSessionAttention: (sessionId: string) => void;
  onCloseSession: (sessionId: string) => void;
  onCloseSessionAndKillTmux: (sessionId: string) => Promise<void>;
  onOpenCommandCenter: (mode: CommandCenterMode) => void;
  onSplitStage: (orientation: StageLayoutOrientation) => void;
  onResetToSinglePane: (sessionId?: string | null) => void;
  onFocusPane: (paneId: StagePaneId) => void;
  onClosePane: (paneId: StagePaneId) => void;
  onResizeStageAdjacentPanes: (dividerIndex: number, deltaRatio: number) => void;
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
  layout,
  workspaceSessions,
  sessionList,
  activeSessionId,
  idleAttentionSessionIds,
  lastViewedRuntimeEventAtMsBySessionId,
  dismissedAttentionKeyBySessionId,
  projects,
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
  isSidebarOpen,
  isRightPanelOpen,
  onToggleSidebar,
  onToggleRightPanel,
  onSelectSession,
  onDismissSessionAttention,
  onCloseSession,
  onCloseSessionAndKillTmux,
  onOpenCommandCenter,
  onSplitStage,
  onResetToSinglePane,
  onFocusPane,
  onClosePane,
  onResizeStageAdjacentPanes,
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

  const handleOpenCommandCenterForPane = useCallback((paneId: StagePaneId) => {
    onOpenCommandCenter({
      kind: "open-in-pane",
      targetPaneId: paneId,
    });
  }, [onOpenCommandCenter]);

  const canSplitStage = Boolean(layout && layout.panes.length < MAX_STAGE_PANES);
  const layoutOrientationClass = layout?.orientation === "horizontal" ? "flex-col" : "flex-row";

  return (
    <main className="flex flex-1 min-w-0 h-full bg-main flex-col">
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
              sessionList={sessionList}
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
                            onOpenCommandCenter={() => handleOpenCommandCenterForPane(pane.id)}
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
