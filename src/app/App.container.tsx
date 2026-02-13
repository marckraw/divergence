import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { AnimatePresence } from "framer-motion";
import Sidebar from "../widgets/sidebar";
import MainArea from "../widgets/main-area";
import { InboxPanel } from "../features/inbox";
import {
  AutomationsPanel,
  runAutomationNow,
  reconcileAutomationRuns,
  useAutomationRunPoller,
  useAutomationScheduler,
} from "../features/automations";
import type { AutomationRunTriggerSource } from "../entities/automation";
import QuickSwitcher from "../features/quick-switcher";
import Settings from "../widgets/settings-modal";
import {
  executeCreateDivergence,
} from "../features/create-divergence";
import { MergeNotification, useMergeDetection, type MergeNotificationData } from "../features/merge-detection";
import { executeDeleteDivergence } from "../features/delete-divergence";
import { executeRemoveProject } from "../features/remove-project";
import { TaskCenterPage, TaskToasts, useTaskCenter } from "../features/task-center";
import { hydrateTasksFromAutomationRuns } from "../entities/task";
import type { WorkSidebarMode, WorkSidebarTab } from "../features/work-sidebar";
import { useAllDivergences } from "../entities/divergence";
import { useProjectSettingsMap, useProjects } from "../entities/project";
import { useAutomations } from "../entities/automation";
import {
  useInboxEvents,
  insertInboxEvent,
  getGithubPollState,
  upsertGithubPollState,
} from "../entities/inbox-event";
import { useAppSettings } from "../shared";
import { useUpdater } from "../shared";
import type { Project, Divergence, TerminalSession, SplitOrientation, BackgroundTask } from "../entities";
import { buildSplitTmuxSessionName } from "../entities/terminal-session";
import { getRalphyConfigSummary } from "../shared/api/ralphyConfig.api";
import { killTmuxSession } from "../shared/api/tmuxSessions.api";
import {
  renderReviewAgentCommand,
  writeReviewBriefFile,
  type DiffReviewAgent,
} from "../features/diff-review";
import { notifyCommandFinished } from "../shared";
import { resolveProjectForNewDivergence } from "./lib/appSelection.pure";
import { buildTerminalSession, buildWorkspaceKey, generateSessionEntropy } from "./lib/sessionBuilder.pure";
import {
  buildIdleNotificationTargetLabel,
  shouldNotifyIdle,
} from "./lib/idleNotification.pure";
import { resolveAppShortcut } from "./lib/appShortcuts.pure";
import {
  buildGithubInboxBody,
  buildGithubInboxExternalId,
  buildGithubInboxTitle,
  buildGithubRepoTarget,
  classifyGithubPullRequestEvent,
} from "./lib/githubInbox.pure";
import { fetchGithubPullRequests } from "./api/githubPullRequests.api";
import type { GithubRepoTarget } from "./model/githubPullRequests.types";

const NOTIFY_MIN_BUSY_MS = 5000;
const NOTIFY_IDLE_DELAY_MS = 1500;
const NOTIFY_COOLDOWN_MS = 3000;
const GITHUB_POLL_INTERVAL_MS = 2 * 60_000;
const GITHUB_INITIAL_POLL_DELAY_MS = 15_000;

function App() {
  const updater = useUpdater(true);
  const { projects, addProject, removeProject, loading: projectsLoading } = useProjects();
  const {
    divergencesByProject,
    refresh: refreshDivergences,
    loading: divergencesLoading,
  } = useAllDivergences();
  const { settingsByProjectId, updateProjectSettings } = useProjectSettingsMap(projects);
  const { settings: appSettings } = useAppSettings();
  const [sessions, setSessions] = useState<Map<string, TerminalSession>>(new Map());
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [splitBySessionId, setSplitBySessionId] = useState<Map<string, { orientation: SplitOrientation }>>(new Map());
  const [reconnectBySessionId, setReconnectBySessionId] = useState<Map<string, number>>(new Map());
  const [showQuickSwitcher, setShowQuickSwitcher] = useState(false);
  const [showFileQuickSwitcher, setShowFileQuickSwitcher] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [createDivergenceFor, setCreateDivergenceFor] = useState<Project | null>(null);
  const [mergeNotification, setMergeNotification] = useState<MergeNotificationData | null>(null);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(256);
  const [isDraggingSidebar, setIsDraggingSidebar] = useState(false);
  const [sidebarMode, setSidebarMode] = useState<WorkSidebarMode>("projects");
  const [workTab, setWorkTab] = useState<WorkSidebarTab>("inbox");
  const [githubRepoTargets, setGithubRepoTargets] = useState<GithubRepoTarget[]>([]);
  const sessionsRef = useRef<Map<string, TerminalSession>>(sessions);
  const activeSessionIdRef = useRef<string | null>(activeSessionId);
  const statusBySessionRef = useRef<Map<string, TerminalSession["status"]>>(new Map());
  const busySinceRef = useRef<Map<string, number>>(new Map());
  const idleNotifyTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const lastNotifiedAtRef = useRef<Map<string, number>>(new Map());
  const commandBySessionIdRef = useRef<Map<string, (command: string) => void>>(new Map());
  const githubRepoTargetsRef = useRef<GithubRepoTarget[]>([]);
  const githubPollingInFlightRef = useRef(false);
  const githubTokenWarningShownRef = useRef(false);
  const dragStartXRef = useRef(0);
  const dragStartWidthRef = useRef(0);
  const {
    automations,
    runs: automationRuns,
    latestRunByAutomationId,
    loading: automationsLoading,
    error: automationsError,
    refresh: refreshAutomations,
    createAutomation,
    updateAutomation: saveAutomation,
    removeAutomation,
  } = useAutomations();

  const automationLookupById = useMemo(() => {
    const map = new Map<number, { name: string; projectId: number }>();
    for (const a of automations) {
      map.set(a.id, { name: a.name, projectId: a.projectId });
    }
    return map;
  }, [automations]);

  const projectLookupById = useMemo(() => {
    const map = new Map<number, { name: string; path: string }>();
    for (const p of projects) {
      map.set(p.id, { name: p.name, path: p.path });
    }
    return map;
  }, [projects]);

  const hydratedTasks = useMemo(() => {
    return hydrateTasksFromAutomationRuns(automationRuns, automationLookupById, projectLookupById);
  }, [automationRuns, automationLookupById, projectLookupById]);

  const {
    runningTasks,
    recentTasks,
    toasts,
    runningCount,
    focusedTaskId,
    dismissToast,
    dismissTask,
    dismissAllRecentTasks,
    viewTask,
    retryTask,
    runTask,
  } = useTaskCenter(2, hydratedTasks);
  const {
    events: inboxEvents,
    filter: inboxFilter,
    unreadCount: inboxUnreadCount,
    loading: inboxLoading,
    error: inboxError,
    setFilter: setInboxFilter,
    refresh: refreshInbox,
    markRead: markInboxRead,
    markAllRead: markAllInboxRead,
  } = useInboxEvents("all");

  // Automation run poller — monitors running tmux-based automation runs
  useAutomationRunPoller({
    onRunCompleted: useCallback((runId: number) => {
      console.log(`Automation run ${runId} completed successfully.`);
      void refreshAutomations();
    }, [refreshAutomations]),
    onRunFailed: useCallback((runId: number, error: string) => {
      console.warn(`Automation run ${runId} failed: ${error}`);
      void refreshAutomations();
    }, [refreshAutomations]),
    onOutputUpdate: useCallback(() => {
      // Output updates are available but not displayed in this phase
    }, []),
  });

  // Reconcile automation runs on startup
  useEffect(() => {
    void reconcileAutomationRuns().then(() => {
      void refreshAutomations();
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    sessionsRef.current = sessions;
  }, [sessions]);

  useEffect(() => {
    activeSessionIdRef.current = activeSessionId;
  }, [activeSessionId]);

  useEffect(() => {
    githubRepoTargetsRef.current = githubRepoTargets;
  }, [githubRepoTargets]);

  // Build projects by ID map for merge detection
  const projectsById = useMemo(() => {
    const map = new Map<number, { name: string }>();
    projects.forEach(p => map.set(p.id, { name: p.name }));
    return map;
  }, [projects]);

  const projectById = useMemo(() => {
    const map = new Map<number, Project>();
    projects.forEach((project) => map.set(project.id, project));
    return map;
  }, [projects]);

  // Flatten divergences for merge detection
  const allDivergences = useMemo(() => {
    const all: Divergence[] = [];
    divergencesByProject.forEach(divs => all.push(...divs));
    return all;
  }, [divergencesByProject]);

  const refreshGithubRepoTargets = useCallback(async () => {
    if (projects.length === 0) {
      setGithubRepoTargets([]);
      return;
    }

    const targets = await Promise.all(projects.map(async (project) => {
      try {
        const config = await getRalphyConfigSummary(project.path);
        if (config.status !== "ok") {
          return null;
        }
        const owner = config.summary.integrations?.github?.owner?.trim();
        const repo = config.summary.integrations?.github?.repo?.trim();
        if (!owner || !repo) {
          return null;
        }
        return buildGithubRepoTarget({
          projectId: project.id,
          projectName: project.name,
          owner,
          repo,
        });
      } catch (error) {
        console.warn(`Failed to load Ralphy config for ${project.name}:`, error);
        return null;
      }
    }));

    setGithubRepoTargets(targets.filter((target): target is GithubRepoTarget => target !== null));
  }, [projects]);

  useEffect(() => {
    void refreshGithubRepoTargets();
  }, [refreshGithubRepoTargets]);

  const clearIdleNotifyTimer = useCallback((sessionId: string) => {
    const existing = idleNotifyTimersRef.current.get(sessionId);
    if (existing) {
      clearTimeout(existing);
      idleNotifyTimersRef.current.delete(sessionId);
    }
  }, []);

  const clearNotificationTracking = useCallback((sessionId: string) => {
    clearIdleNotifyTimer(sessionId);
    busySinceRef.current.delete(sessionId);
    statusBySessionRef.current.delete(sessionId);
    lastNotifiedAtRef.current.delete(sessionId);
  }, [clearIdleNotifyTimer]);

  const scheduleIdleNotification = useCallback((sessionId: string, startedAt: number) => {
    clearIdleNotifyTimer(sessionId);

    const timeoutId = setTimeout(async () => {
      const currentSession = sessionsRef.current.get(sessionId);
      const now = Date.now();
      const duration = now - startedAt;
      const lastNotifiedAt = lastNotifiedAtRef.current.get(sessionId) ?? 0;
      const activeId = activeSessionIdRef.current;
      const shouldNotify = shouldNotifyIdle({
        sessionExists: Boolean(currentSession),
        sessionStatus: currentSession?.status ?? null,
        durationMs: duration,
        notifyMinBusyMs: NOTIFY_MIN_BUSY_MS,
        nowMs: now,
        lastNotifiedAtMs: lastNotifiedAt,
        notifyCooldownMs: NOTIFY_COOLDOWN_MS,
        isWindowFocused: document.hasFocus(),
        isSessionActive: activeId === sessionId,
      });
      if (!shouldNotify || !currentSession) {
        return;
      }

      const projectName = projectsById.get(currentSession.projectId)?.name ?? currentSession.name;
      const targetLabel = buildIdleNotificationTargetLabel(currentSession, projectName);

      await notifyCommandFinished("Command finished", `${targetLabel} is idle`);
      lastNotifiedAtRef.current.set(sessionId, now);
      busySinceRef.current.delete(sessionId);
    }, NOTIFY_IDLE_DELAY_MS);

    idleNotifyTimersRef.current.set(sessionId, timeoutId);
  }, [clearIdleNotifyTimer, projectsById]);

  // Reset banner dismiss when a new update or error arrives
  useEffect(() => {
    if (updater.status === "available" || updater.status === "error") {
      setBannerDismissed(false);
    }
  }, [updater.status]);

  // Merge detection
  useMergeDetection(allDivergences, projectsById, (notification) => {
    setMergeNotification(notification);
  });

  const createSession = useCallback((
    type: "project" | "divergence",
    target: Project | Divergence
  ): TerminalSession => {
    const id = `${type}-${target.id}`;
    const existing = sessionsRef.current.get(id);
    if (existing) {
      return existing;
    }

    const session = buildTerminalSession({
      type,
      target,
      settingsByProjectId,
      projectsById,
      globalTmuxHistoryLimit: appSettings.tmuxHistoryLimit,
    });

    setSessions((previous) => {
      const next = new Map(previous);
      next.set(id, session);
      return next;
    });
    return session;
  }, [settingsByProjectId, projectsById, appSettings.tmuxHistoryLimit]);

  const createManualSession = useCallback((
    type: "project" | "divergence",
    target: Project | Divergence
  ): TerminalSession => {
    const entropy = generateSessionEntropy();
    const sessionId = `${type}-${target.id}#manual-${entropy}`;
    const workspaceSessions = Array.from(sessionsRef.current.values())
      .filter((session) => session.type === type && session.targetId === target.id);
    const manualIndex = workspaceSessions.filter((session) => session.sessionRole === "manual").length + 1;

    const base = buildTerminalSession({
      type,
      target,
      settingsByProjectId,
      projectsById,
      globalTmuxHistoryLimit: appSettings.tmuxHistoryLimit,
    });
    const session: TerminalSession = {
      ...base,
      id: sessionId,
      workspaceKey: buildWorkspaceKey(type, target.id),
      sessionRole: "manual",
      name: `${base.name} • session #${manualIndex}`,
      tmuxSessionName: base.useTmux
        ? buildSplitTmuxSessionName(base.tmuxSessionName, `manual-${entropy}`)
        : base.tmuxSessionName,
      status: "idle",
      lastActivity: new Date(),
    };

    setSessions((previous) => {
      const next = new Map(previous);
      next.set(session.id, session);
      return next;
    });
    return session;
  }, [settingsByProjectId, projectsById, appSettings.tmuxHistoryLimit]);

  const handleSelectProject = useCallback((project: Project) => {
    const session = createSession("project", project);
    setActiveSessionId(session.id);
    setSidebarMode("projects");
  }, [createSession]);

  const handleSelectDivergence = useCallback((divergence: Divergence) => {
    const session = createSession("divergence", divergence);
    setActiveSessionId(session.id);
    setSidebarMode("projects");
  }, [createSession]);

  const handleCreateAdditionalSession = useCallback((
    type: "project" | "divergence",
    item: Project | Divergence
  ) => {
    const session = createManualSession(type, item);
    setActiveSessionId(session.id);
    setSidebarMode("projects");
  }, [createManualSession]);

  const handleCloseSession = useCallback((sessionId: string) => {
    clearNotificationTracking(sessionId);
    setSessions(prev => {
      const newSessions = new Map(prev);
      newSessions.delete(sessionId);
      return newSessions;
    });
    setSplitBySessionId(prev => {
      if (!prev.has(sessionId)) {
        return prev;
      }
      const next = new Map(prev);
      next.delete(sessionId);
      return next;
    });
    setReconnectBySessionId(prev => {
      if (!prev.has(sessionId)) {
        return prev;
      }
      const next = new Map(prev);
      next.delete(sessionId);
      return next;
    });
    commandBySessionIdRef.current.delete(sessionId);
    if (activeSessionId === sessionId) {
      const remainingSessions = Array.from(sessions.keys()).filter(id => id !== sessionId);
      setActiveSessionId(remainingSessions[0] || null);
    }
  }, [activeSessionId, sessions, clearNotificationTracking]);

  const handleCloseSessionAndKillTmux = useCallback(async (sessionId: string) => {
    const session = sessionsRef.current.get(sessionId);
    handleCloseSession(sessionId);

    if (!session?.useTmux) {
      return;
    }

    const tmuxNames = Array.from(new Set([
      session.tmuxSessionName,
      buildSplitTmuxSessionName(session.tmuxSessionName, "pane-2"),
    ]));
    for (const tmuxName of tmuxNames) {
      try {
        await killTmuxSession(tmuxName);
      } catch (error) {
        console.warn(`Failed to kill tmux session ${tmuxName}:`, error);
      }
    }
  }, [handleCloseSession]);

  const handleRegisterTerminalCommand = useCallback((sessionId: string, sendCommand: (command: string) => void) => {
    commandBySessionIdRef.current.set(sessionId, sendCommand);
  }, []);

  const handleUnregisterTerminalCommand = useCallback((sessionId: string) => {
    commandBySessionIdRef.current.delete(sessionId);
  }, []);

  const waitForSessionCommand = useCallback((sessionId: string, timeoutMs = 8000): Promise<((command: string) => void)> => {
    const startedAt = Date.now();
    return new Promise((resolve, reject) => {
      const poll = () => {
        const command = commandBySessionIdRef.current.get(sessionId);
        if (command) {
          resolve(command);
          return;
        }
        if (Date.now() - startedAt >= timeoutMs) {
          reject(new Error("Timed out while waiting for terminal command channel."));
          return;
        }
        window.setTimeout(poll, 50);
      };
      poll();
    });
  }, []);

  const sendCommandToSession = useCallback(async (
    sessionId: string,
    command: string,
    options?: {
      timeoutMs?: number;
      activateIfNeeded?: boolean;
    }
  ): Promise<void> => {
    const existingSendCommand = commandBySessionIdRef.current.get(sessionId);
    if (existingSendCommand) {
      existingSendCommand(command);
      return;
    }

    const activateIfNeeded = options?.activateIfNeeded ?? true;
    const timeoutMs = options?.timeoutMs ?? 15_000;
    const previousActiveSessionId = activeSessionIdRef.current;
    const shouldActivate = activateIfNeeded && previousActiveSessionId !== sessionId;

    if (shouldActivate) {
      setActiveSessionId(sessionId);
    }

    try {
      const sendCommand = await waitForSessionCommand(sessionId, timeoutMs);
      sendCommand(command);
    } finally {
      if (shouldActivate && activeSessionIdRef.current === sessionId) {
        setActiveSessionId(previousActiveSessionId);
      }
    }
  }, [waitForSessionCommand]);

  const createReviewAgentSession = useCallback((sourceSession: TerminalSession, agent: DiffReviewAgent): TerminalSession => {
    const entropy = generateSessionEntropy();
    const shortRunId = entropy.split("-")[1]?.padStart(3, "0") ?? "000";
    const sessionId = `${sourceSession.type}-${sourceSession.targetId}#review-${entropy}`;
    const tmuxSessionName = sourceSession.useTmux
      ? buildSplitTmuxSessionName(sourceSession.tmuxSessionName, `review-${entropy}`)
      : sourceSession.tmuxSessionName;
    const session: TerminalSession = {
      ...sourceSession,
      id: sessionId,
      sessionRole: "review-agent",
      name: `${sourceSession.name} • ${agent} #${shortRunId}`,
      tmuxSessionName,
      status: "idle",
      lastActivity: new Date(),
    };

    setSessions((previous) => {
      const next = new Map(previous);
      next.set(session.id, session);
      return next;
    });
    return session;
  }, []);

  const handleRunReviewAgent = useCallback(async (input: {
    sourceSessionId: string;
    workspacePath: string;
    agent: DiffReviewAgent;
    briefMarkdown: string;
  }) => {
    const sourceSession = sessionsRef.current.get(input.sourceSessionId);
    if (!sourceSession) {
      throw new Error("Source session not found.");
    }

    const { path: briefPath } = await writeReviewBriefFile(input.workspacePath, input.briefMarkdown);
    const template = input.agent === "claude"
      ? appSettings.agentCommandClaude
      : appSettings.agentCommandCodex;
    if (!template.trim()) {
      throw new Error(`No ${input.agent} command template configured in settings.`);
    }

    const command = renderReviewAgentCommand(template, {
      workspacePath: input.workspacePath,
      briefPath,
    });
    const reviewSession = createReviewAgentSession(sourceSession, input.agent);
    setActiveSessionId(reviewSession.id);

    await sendCommandToSession(reviewSession.id, command, { activateIfNeeded: false });
  }, [
    appSettings.agentCommandClaude,
    appSettings.agentCommandCodex,
    createReviewAgentSession,
    sendCommandToSession,
  ]);

  const handleSplitSession = useCallback((sessionId: string, orientation: SplitOrientation) => {
    setSplitBySessionId(prev => {
      const next = new Map(prev);
      next.set(sessionId, { orientation });
      return next;
    });
  }, []);

  const handleResetSplitSession = useCallback((sessionId: string) => {
    setSplitBySessionId(prev => {
      if (!prev.has(sessionId)) {
        return prev;
      }
      const next = new Map(prev);
      next.delete(sessionId);
      return next;
    });
  }, []);

  const handleReconnectSession = useCallback((sessionId: string) => {
    setReconnectBySessionId(prev => {
      const next = new Map(prev);
      const current = next.get(sessionId) ?? 0;
      next.set(sessionId, current + 1);
      return next;
    });
  }, []);

  const toggleSidebar = useCallback(() => {
    setIsSidebarOpen(prev => !prev);
  }, []);

  const toggleRightPanel = useCallback(() => {
    setIsRightPanelOpen(prev => !prev);
  }, []);

  const handleSidebarDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingSidebar(true);
    dragStartXRef.current = e.clientX;
    dragStartWidthRef.current = sidebarWidth;
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientX - dragStartXRef.current;
      const newWidth = Math.min(480, Math.max(180, dragStartWidthRef.current + delta));
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsDraggingSidebar(false);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  }, [sidebarWidth]);

  const handleSidebarDragDoubleClick = useCallback(() => {
    setSidebarWidth(256);
  }, []);

  const handleSidebarModeChange = useCallback((mode: WorkSidebarMode) => {
    setSidebarMode(mode);
    if (mode === "work") {
      setShowQuickSwitcher(false);
      setShowSettings(false);
    }
  }, []);

  const handleWorkTabChange = useCallback((tab: WorkSidebarTab) => {
    setSidebarMode("work");
    setWorkTab(tab);
  }, []);

  const handleSessionStatusChange = useCallback((sessionId: string, status: TerminalSession["status"]) => {
    const previousStatus = statusBySessionRef.current.get(sessionId) ?? "idle";
    statusBySessionRef.current.set(sessionId, status);

    if (status === "busy") {
      busySinceRef.current.set(sessionId, Date.now());
      clearIdleNotifyTimer(sessionId);
    } else if (status === "active") {
      clearIdleNotifyTimer(sessionId);
    } else if (status === "idle" && previousStatus !== "idle") {
      const startedAt = busySinceRef.current.get(sessionId);
      if (startedAt) {
        scheduleIdleNotification(sessionId, startedAt);
      }
    }

    setSessions(prev => {
      const newSessions = new Map(prev);
      const session = newSessions.get(sessionId);
      if (session) {
        if (session.status === status) {
          return prev;
        }
        newSessions.set(sessionId, { ...session, status, lastActivity: new Date() });
      }
      return newSessions;
    });
  }, [clearIdleNotifyTimer, scheduleIdleNotification]);

  const handleSessionRendererChange = useCallback((sessionId: string, renderer: "webgl" | "canvas") => {
    setSessions(prev => {
      const newSessions = new Map(prev);
      const session = newSessions.get(sessionId);
      if (session) {
        if (session.rendererType === renderer) {
          return prev;
        }
        newSessions.set(sessionId, { ...session, rendererType: renderer });
      }
      return newSessions;
    });
  }, []);

  useEffect(() => {
    setSessions(prev => {
      let changed = false;
      const next = new Map(prev);
      for (const [id, session] of next) {
        const projectSettings = settingsByProjectId.get(session.projectId);
        const projectHistoryLimit = projectSettings?.tmuxHistoryLimit ?? null;
        const effectiveHistoryLimit = projectHistoryLimit ?? appSettings.tmuxHistoryLimit;
        if (session.tmuxHistoryLimit !== effectiveHistoryLimit) {
          next.set(id, { ...session, tmuxHistoryLimit: effectiveHistoryLimit });
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [appSettings.tmuxHistoryLimit, settingsByProjectId]);

  const handleAddProject = useCallback(async (name: string, path: string) => {
    await addProject(name, path);
  }, [addProject]);

  const closeSessionsForProject = useCallback((projectId: number) => {
    const sessionsToClose = Array.from(sessionsRef.current.entries())
      .filter(([, session]) => session.projectId === projectId)
      .map(([sessionId]) => sessionId);
    sessionsToClose.forEach(handleCloseSession);
  }, [handleCloseSession]);

  const closeSessionsForDivergence = useCallback((divergenceId: number) => {
    const sessionsToClose = Array.from(sessionsRef.current.entries())
      .filter(([, session]) => session.type === "divergence" && session.targetId === divergenceId)
      .map(([sessionId]) => sessionId);
    sessionsToClose.forEach(handleCloseSession);
  }, [handleCloseSession]);

  const handleCreateDivergence = useCallback(async (
    project: Project,
    branchName: string,
    useExistingBranch: boolean
  ): Promise<Divergence> => {
    return executeCreateDivergence({
      project,
      branchName,
      useExistingBranch,
      runTask,
      refreshDivergences,
    });
  }, [refreshDivergences, runTask]);

  const handleDeleteDivergence = useCallback(async (
    divergence: Divergence,
    origin: string
  ): Promise<void> => {
    const projectName = projectsById.get(divergence.projectId)?.name ?? "project";
    await executeDeleteDivergence({
      divergence,
      origin,
      projectName,
      runTask,
      closeSessionsForDivergence,
      refreshDivergences,
    });
  }, [closeSessionsForDivergence, projectsById, refreshDivergences, runTask]);

  const handleRemoveProject = useCallback(async (id: number): Promise<void> => {
    const projectName = projectsById.get(id)?.name ?? "project";
    const divergences = divergencesByProject.get(id) ?? [];

    await executeRemoveProject({
      projectId: id,
      projectName,
      divergences,
      runTask,
      removeProject,
      closeSessionsForProject,
      refreshDivergences,
    });
  }, [
    closeSessionsForProject,
    divergencesByProject,
    projectsById,
    refreshDivergences,
    removeProject,
    runTask,
  ]);

  const executeAutomationRun = useCallback(async (
    automationId: number,
    triggerSource?: AutomationRunTriggerSource,
  ): Promise<void> => {
    const automation = automations.find((item) => item.id === automationId);
    if (!automation) {
      if (triggerSource) return; // scheduled runs silently skip missing automations
      throw new Error("Automation not found.");
    }
    const project = projectById.get(automation.projectId) ?? null;
    await runAutomationNow({
      automation,
      project,
      runTask,
      agentCommandClaude: appSettings.agentCommandClaude,
      agentCommandCodex: appSettings.agentCommandCodex,
      triggerSource,
    });
    await Promise.all([refreshAutomations(), refreshDivergences()]);
  }, [
    appSettings.agentCommandClaude,
    appSettings.agentCommandCodex,
    automations,
    projectById,
    refreshAutomations,
    refreshDivergences,
    runTask,
  ]);

  const handleRunAutomationNow = useCallback(
    (automationId: number) => executeAutomationRun(automationId),
    [executeAutomationRun],
  );

  const handleRunScheduledAutomation = useCallback(
    (automationId: number, triggerSource: AutomationRunTriggerSource) =>
      executeAutomationRun(automationId, triggerSource),
    [executeAutomationRun],
  );

  // Automation scheduler — periodically triggers due automations
  useAutomationScheduler({
    automations,
    projectById,
    onTriggerRun: handleRunScheduledAutomation,
  });

  const handleCreateAutomation = useCallback(async (input: Parameters<typeof createAutomation>[0]) => {
    await createAutomation(input);
    await refreshAutomations();
  }, [createAutomation, refreshAutomations]);

  const handleUpdateAutomation = useCallback(async (input: Parameters<typeof saveAutomation>[0]) => {
    await saveAutomation(input);
    await refreshAutomations();
  }, [refreshAutomations, saveAutomation]);

  const handleDeleteAutomation = useCallback(async (automationId: number) => {
    await removeAutomation(automationId);
    await refreshAutomations();
  }, [refreshAutomations, removeAutomation]);

  const handleViewTaskCenterTask = useCallback((taskId: string) => {
    viewTask(taskId);
    setIsSidebarOpen(true);
    setSidebarMode("work");
    setWorkTab("task_center");
  }, [viewTask]);

  const handleAttachToAutomationSession = useCallback(async (task: BackgroundTask) => {
    const { tmuxSessionName, projectId, path } = task.target;
    if (!tmuxSessionName || !projectId || !path) return;

    const project = projectById.get(projectId);
    if (!project) return;

    // Create a non-tmux terminal session. Instead of using the tmux bootstrap
    // (which cannot target a specific window), we spawn a plain shell and send
    // `tmux attach` as a command. This lets us select window 0 first so the
    // user lands on the main automation output, not a random agent window.
    const entropy = generateSessionEntropy();
    const sessionId = `project-${projectId}#automation-${entropy}`;
    const base = buildTerminalSession({
      type: "project",
      target: project,
      settingsByProjectId,
      projectsById,
      globalTmuxHistoryLimit: appSettings.tmuxHistoryLimit,
    });
    const session: TerminalSession = {
      ...base,
      id: sessionId,
      workspaceKey: buildWorkspaceKey("project", projectId),
      sessionRole: "manual",
      name: task.target.label || `${base.name} • automation`,
      useTmux: false,
      status: "idle",
      lastActivity: new Date(),
    };

    setSessions((prev) => {
      const next = new Map(prev);
      next.set(session.id, session);
      return next;
    });
    setActiveSessionId(session.id);
    setSidebarMode("projects");

    // Attach to the automation's tmux session, targeting window 0 (main output)
    const escapedName = tmuxSessionName.replace(/'/g, "'\\''");
    const attachCommand = `tmux select-window -t '${escapedName}':0 2>/dev/null; exec tmux attach -t '${escapedName}'`;
    try {
      await sendCommandToSession(session.id, attachCommand, { activateIfNeeded: false });
    } catch (err) {
      console.warn("Failed to attach to automation tmux session:", err);
    }
  }, [projectById, settingsByProjectId, projectsById, appSettings.tmuxHistoryLimit, sendCommandToSession]);

  const pollGithubInbox = useCallback(async (): Promise<void> => {
    if (githubPollingInFlightRef.current) {
      return;
    }

    const repoTargets = githubRepoTargetsRef.current;
    if (repoTargets.length === 0) {
      return;
    }

    githubPollingInFlightRef.current = true;
    let insertedCount = 0;
    try {
      for (const repoTarget of repoTargets) {
        const nowMs = Date.now();
        const lastPolledAtMs = await getGithubPollState(repoTarget.repoKey);
        if (lastPolledAtMs === null) {
          await upsertGithubPollState(repoTarget.repoKey, nowMs);
          continue;
        }

        let pullRequests;
        try {
          pullRequests = await fetchGithubPullRequests(repoTarget.owner, repoTarget.repo);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          if (message.toLowerCase().includes("github_token")) {
            if (!githubTokenWarningShownRef.current) {
              githubTokenWarningShownRef.current = true;
              console.warn("GitHub polling is disabled because GITHUB_TOKEN is missing.");
            }
            return;
          }
          console.warn(`GitHub polling failed for ${repoTarget.repoKey}:`, error);
          continue;
        }

        for (const pullRequest of pullRequests) {
          try {
            const kind = classifyGithubPullRequestEvent(pullRequest, lastPolledAtMs);
            if (!kind) {
              continue;
            }

            const eventAtMs = kind === "github_pr_opened"
              ? pullRequest.createdAtMs
              : pullRequest.updatedAtMs;
            const insertedId = await insertInboxEvent({
              kind,
              source: "github",
              projectId: repoTarget.projectId,
              externalId: buildGithubInboxExternalId(
                repoTarget.repoKey,
                pullRequest.id,
                kind,
                eventAtMs
              ),
              title: buildGithubInboxTitle(repoTarget.repoKey, pullRequest.number, kind),
              body: buildGithubInboxBody(pullRequest),
              payloadJson: JSON.stringify({
                projectId: repoTarget.projectId,
                repoKey: repoTarget.repoKey,
                pullRequest,
              }),
              createdAtMs: eventAtMs,
            });
            if (insertedId) {
              insertedCount += 1;
            }
          } catch (error) {
            console.warn(`Failed to process PR #${pullRequest.number} for ${repoTarget.repoKey}:`, error);
          }
        }

        await upsertGithubPollState(repoTarget.repoKey, nowMs);
      }

      if (insertedCount > 0) {
        await refreshInbox();
      }
    } finally {
      githubPollingInFlightRef.current = false;
    }
  }, [refreshInbox]);

  useEffect(() => {
    const initialTimerId = window.setTimeout(() => {
      void pollGithubInbox();
    }, GITHUB_INITIAL_POLL_DELAY_MS);
    const timerId = window.setInterval(() => {
      void pollGithubInbox();
    }, GITHUB_POLL_INTERVAL_MS);

    return () => {
      window.clearTimeout(initialTimerId);
      window.clearInterval(timerId);
    };
  }, [pollGithubInbox]);

  const resolveProjectForNewDivergenceCallback = useCallback((): Project | null => {
    return resolveProjectForNewDivergence({
      activeSessionId,
      sessions,
      projects,
    });
  }, [activeSessionId, sessions, projects]);

  // Keyboard shortcuts
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const isFromEditor = e.target instanceof HTMLElement
      ? Boolean(e.target.closest("[data-editor-root='true'], .cm-editor"))
      : false;
    const action = resolveAppShortcut(e, {
      isFromEditor,
      hasActiveSession: Boolean(activeSessionId),
      activeSessionId,
      sessionCount: sessions.size,
      hasCreateDivergenceModalOpen: Boolean(createDivergenceFor),
      canResolveProjectForNewDivergence: Boolean(resolveProjectForNewDivergenceCallback()),
    });
    if (!action) {
      return;
    }

    e.preventDefault();
    const sessionIds = Array.from(sessions.keys());

    switch (action.type) {
      case "toggle_quick_switcher":
        setShowQuickSwitcher(prev => !prev);
        return;
      case "toggle_file_quick_switcher":
        setShowFileQuickSwitcher(prev => !prev);
        return;
      case "open_work_inbox":
        setIsSidebarOpen(true);
        setSidebarMode("work");
        setWorkTab("inbox");
        return;
      case "toggle_settings":
        setShowSettings(prev => !prev);
        return;
      case "toggle_right_panel":
        toggleRightPanel();
        return;
      case "toggle_sidebar":
        toggleSidebar();
        return;
      case "close_overlays":
        setShowQuickSwitcher(false);
        setShowFileQuickSwitcher(false);
        setShowSettings(false);
        return;
      case "close_active_session":
        if (activeSessionId) {
          handleCloseSession(activeSessionId);
        }
        return;
      case "new_divergence": {
        const project = resolveProjectForNewDivergenceCallback();
        if (project) {
          setShowQuickSwitcher(false);
          setShowSettings(false);
          setCreateDivergenceFor(project);
        }
        return;
      }
      case "split_terminal":
        if (activeSessionId) {
          handleSplitSession(activeSessionId, action.orientation);
        }
        return;
      case "reconnect_terminal":
        if (activeSessionId) {
          handleReconnectSession(activeSessionId);
        }
        return;
      case "select_tab":
        if (action.index < sessionIds.length) {
          setActiveSessionId(sessionIds[action.index]);
        }
        return;
      case "select_previous_tab":
        if (activeSessionId && sessionIds.length > 1) {
          const currentIndex = sessionIds.indexOf(activeSessionId);
          const prevIndex = currentIndex > 0 ? currentIndex - 1 : sessionIds.length - 1;
          setActiveSessionId(sessionIds[prevIndex]);
        }
        return;
      case "select_next_tab":
        if (activeSessionId && sessionIds.length > 1) {
          const currentIndex = sessionIds.indexOf(activeSessionId);
          const nextIndex = currentIndex < sessionIds.length - 1 ? currentIndex + 1 : 0;
          setActiveSessionId(sessionIds[nextIndex]);
        }
        return;
      default:
        return;
    }
  }, [
    sessions,
    activeSessionId,
    createDivergenceFor,
    resolveProjectForNewDivergenceCallback,
    handleCloseSession,
    handleSplitSession,
    handleReconnectSession,
    toggleSidebar,
    toggleRightPanel,
  ]);

  // Set up keyboard listener
  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    const theme = appSettings.theme ?? "dark";
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme === "light" ? "light" : "dark";
  }, [appSettings.theme]);

  const editorTheme =
    appSettings.theme === "light"
      ? appSettings.editorThemeForLightMode
      : appSettings.editorThemeForDarkMode;
  const activeSession = activeSessionId ? sessions.get(activeSessionId) ?? null : null;

  return (
    <div className="flex h-full w-full">
      <div
        className={`h-full shrink-0 overflow-hidden${
          isDraggingSidebar ? "" : " transition-[width] duration-200 ease-out"
        }`}
        style={{ width: isSidebarOpen ? sidebarWidth : 0 }}
      >
        <Sidebar
          mode={sidebarMode}
          workTab={workTab}
          onModeChange={handleSidebarModeChange}
          onWorkTabChange={handleWorkTabChange}
          inboxUnreadCount={inboxUnreadCount}
          taskRunningCount={runningCount}
          projects={projects}
          divergencesByProject={divergencesByProject}
          sessions={sessions}
          activeSessionId={activeSessionId}
          createDivergenceFor={createDivergenceFor}
          onCreateDivergenceForChange={setCreateDivergenceFor}
          onSelectProject={handleSelectProject}
          onSelectDivergence={handleSelectDivergence}
          onSelectSession={setActiveSessionId}
          onCloseSession={handleCloseSession}
          onCloseSessionAndKillTmux={handleCloseSessionAndKillTmux}
          onAddProject={handleAddProject}
          onRemoveProject={handleRemoveProject}
          onCreateDivergence={handleCreateDivergence}
          onCreateAdditionalSession={handleCreateAdditionalSession}
          onDeleteDivergence={handleDeleteDivergence}
          isCollapsed={!isSidebarOpen}
        />
      </div>
      {isSidebarOpen && (
        <div
          className="h-full w-1 shrink-0 cursor-col-resize bg-transparent hover:bg-accent/30 active:bg-accent/50 transition-colors"
          onMouseDown={handleSidebarDragStart}
          onDoubleClick={handleSidebarDragDoubleClick}
        />
      )}
      {sidebarMode === "work" ? (
        <div className="flex-1 min-w-0 h-full">
          {workTab === "inbox" && (
            <InboxPanel
              events={inboxEvents}
              filter={inboxFilter}
              loading={inboxLoading}
              error={inboxError}
              onFilterChange={setInboxFilter}
              onRefresh={refreshInbox}
              onMarkRead={markInboxRead}
              onMarkAllRead={markAllInboxRead}
            />
          )}
          {workTab === "task_center" && (
            <TaskCenterPage
              runningTasks={runningTasks}
              recentTasks={recentTasks}
              focusedTaskId={focusedTaskId}
              onRetryTask={retryTask}
              onViewTask={handleViewTaskCenterTask}
              onDismissTask={dismissTask}
              onDismissAllRecentTasks={dismissAllRecentTasks}
              onAttachToAutomationSession={handleAttachToAutomationSession}
            />
          )}
          {workTab === "automations" && (
            <AutomationsPanel
              projects={projects}
              automations={automations}
              latestRunByAutomationId={latestRunByAutomationId}
              loading={automationsLoading}
              error={automationsError}
              onRefresh={refreshAutomations}
              onCreateAutomation={handleCreateAutomation}
              onUpdateAutomation={handleUpdateAutomation}
              onDeleteAutomation={handleDeleteAutomation}
              onRunAutomationNow={handleRunAutomationNow}
            />
          )}
        </div>
      ) : (
        <MainArea
          projects={projects}
          sessions={sessions}
          activeSession={activeSession}
          onCloseSession={handleCloseSession}
          onSelectSession={setActiveSessionId}
          onStatusChange={handleSessionStatusChange}
          onRendererChange={handleSessionRendererChange}
          onRegisterTerminalCommand={handleRegisterTerminalCommand}
          onUnregisterTerminalCommand={handleUnregisterTerminalCommand}
          onRunReviewAgentRequest={handleRunReviewAgent}
          onProjectSettingsSaved={updateProjectSettings}
          splitBySessionId={splitBySessionId}
          onSplitSession={handleSplitSession}
          onResetSplitSession={handleResetSplitSession}
          reconnectBySessionId={reconnectBySessionId}
          onReconnectSession={handleReconnectSession}
          globalTmuxHistoryLimit={appSettings.tmuxHistoryLimit}
          editorTheme={editorTheme}
          divergencesByProject={divergencesByProject}
          projectsLoading={projectsLoading}
          divergencesLoading={divergencesLoading}
          showFileQuickSwitcher={showFileQuickSwitcher}
          onCloseFileQuickSwitcher={() => setShowFileQuickSwitcher(false)}
          isSidebarOpen={isSidebarOpen}
          onToggleSidebar={toggleSidebar}
          isRightPanelOpen={isRightPanelOpen}
          onToggleRightPanel={toggleRightPanel}
        />
      )}

      {/* Quick Switcher */}
      <AnimatePresence>
        {showQuickSwitcher && (
          <QuickSwitcher
            projects={projects}
            divergencesByProject={divergencesByProject}
            sessions={sessions}
            onSelect={(type, item) => {
              if (type === "project") {
                handleSelectProject(item as Project);
              } else if (type === "divergence") {
                handleSelectDivergence(item as Divergence);
              } else {
                setSidebarMode("projects");
                setActiveSessionId((item as TerminalSession).id);
              }
              setShowQuickSwitcher(false);
            }}
            onClose={() => setShowQuickSwitcher(false)}
          />
        )}
      </AnimatePresence>

      {/* Settings */}
      <AnimatePresence>
        {showSettings && (
          <Settings onClose={() => {
            setShowSettings(false);
          }}
            updater={updater}
            projects={projects}
            automations={automations}
            latestRunByAutomationId={latestRunByAutomationId}
            automationsLoading={automationsLoading}
            automationsError={automationsError}
            onRefreshAutomations={refreshAutomations}
            onCreateAutomation={handleCreateAutomation}
            onUpdateAutomation={handleUpdateAutomation}
            onDeleteAutomation={handleDeleteAutomation}
            onRunAutomationNow={handleRunAutomationNow}
          />
        )}
      </AnimatePresence>

      {/* Merge Notification */}
      <AnimatePresence>
        {mergeNotification && (
          <MergeNotification
            divergence={mergeNotification.divergence}
            projectName={mergeNotification.projectName}
            onClose={() => setMergeNotification(null)}
            onDeleteDivergence={handleDeleteDivergence}
          />
        )}
      </AnimatePresence>

      <TaskToasts
        toasts={toasts}
        onDismiss={dismissToast}
        onViewTask={handleViewTaskCenterTask}
      />

      {/* Update Banner */}
      {!bannerDismissed && (updater.status === "available" || updater.status === "downloading" || updater.status === "error") && (
        <div className={`fixed bottom-4 right-4 z-50 rounded-lg px-4 py-3 text-sm text-white shadow-lg ${
          updater.status === "error" ? "bg-red-600" : "bg-blue-600"
        }`}>
          <div className="flex items-center gap-3">
            {updater.status === "available" && (
              <>
                <span>Update {updater.version} available</span>
                <button
                  onClick={updater.downloadAndInstall}
                  className="rounded bg-white px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50"
                >
                  Install & Restart
                </button>
              </>
            )}
            {updater.status === "downloading" && (
              <>
                <span>Downloading update... {updater.progress}%</span>
                <div className="h-1.5 w-24 overflow-hidden rounded-full bg-blue-400">
                  <div
                    className="h-full rounded-full bg-white transition-all"
                    style={{ width: `${updater.progress}%` }}
                  />
                </div>
              </>
            )}
            {updater.status === "error" && (
              <span>{updater.error ?? "Update check failed"}</span>
            )}
            <button
              onClick={() => setBannerDismissed(true)}
              className="ml-1 rounded p-0.5 hover:bg-white/20"
              aria-label="Dismiss"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
