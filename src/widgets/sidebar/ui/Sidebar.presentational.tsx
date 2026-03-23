import { useMemo } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  Button,
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
  EmptyState,
  ErrorBanner,
  getAgentProviderBadgeClass,
  getAgentProviderLabel,
  IconButton,
  SegmentedControl,
  StatusIndicator,
} from "../../../shared";
import CreateDivergenceModal from "../../../features/create-divergence";
import {
  FAST_EASE_OUT,
  SOFT_SPRING,
  getCollapseVariants,
} from "../../../shared";
import {
  getSessionsForWorkspace,
  getSessionStatus,
  isSessionItemActive,
  isSessionActive,
} from "../lib/sidebar.pure";
import {
  buildSidebarNeedsAttentionItems,
  getSidebarAttentionSummary,
  getSidebarSessionAttentionState,
} from "../lib/sidebarAttention.pure";
import type { SidebarPresentationalProps } from "./Sidebar.types";
import type { WorkSidebarTab } from "../../../features/work-sidebar";
import {
  isAgentSession,
  isWorkspaceSessionNeedsAttention,
  type WorkspaceSession,
  type WorkspaceSessionAttentionState,
} from "../../../entities";

const WORK_NAV_ITEMS: Array<{ id: WorkSidebarTab; label: string }> = [
  { id: "inbox", label: "Inbox" },
  { id: "pull_requests", label: "Pull Requests" },
  { id: "task_center", label: "Task Center" },
  { id: "automations", label: "Automations" },
  { id: "ports", label: "Ports" },
  { id: "debug", label: "Debug" },
];

const NEEDS_ATTENTION_PREVIEW_LIMIT = 6;

function SidebarPresentational({
  mode,
  workTab,
  onModeChange,
  onWorkTabChange,
  inboxUnreadCount,
  taskRunningCount,
  projects,
  divergencesByProject,
  sessions,
  activeSessionId,
  idleAttentionSessionIds,
  lastViewedRuntimeEventAtMsBySessionId,
  dismissedAttentionKeyBySessionId,
  createDivergenceFor,
  onCreateDivergenceForChange,
  onSelectProject,
  onSelectDivergence,
  onSelectSession,
  onRevealSession,
  onDismissSessionAttention,
  onCloseSession,
  onDeleteAgentSession,
  onRenameAgentSession,
  onCloseSessionAndKillTmux,
  onCreateAdditionalSession,
  onRemoveProject,
  onCreateDivergence,
  isCollapsed,
  onCreateAgentSession,
  expandedProjects,
  deletingDivergences,
  deleteError,
  hasExpandableProjects,
  isAllExpanded,
  onAddProjectClick,
  onToggleProjectExpand,
  onToggleAllProjects,
  onDeleteDivergenceFromMenu,
  agentProviders,
  workspaces,
  membersByWorkspaceId,
  onSelectWorkspace,
  onCreateWorkspace,
  onDeleteWorkspace,
  onOpenWorkspaceSettings,
  onCreateWorkspaceDivergence,
  workspaceDivergencesByWorkspaceId,
  onSelectWorkspaceDivergence,
  onDeleteWorkspaceDivergence,
  expandedWorkspaces,
  onToggleWorkspaceExpand,
}: SidebarPresentationalProps) {
  const shouldReduceMotion = useReducedMotion();
  const collapseVariants = useMemo(
    () => getCollapseVariants(shouldReduceMotion),
    [shouldReduceMotion]
  );
  const layoutTransition = shouldReduceMotion ? FAST_EASE_OUT : SOFT_SPRING;
  const deletingDivergenceIds = new Set(deletingDivergences.map((item) => item.id));
  const sidebarAttentionOptions = useMemo(
    () => ({
      activeSessionId,
      idleAttentionSessionIds,
      lastViewedRuntimeEventAtMsBySessionId,
      dismissedAttentionKeyBySessionId,
    }),
    [activeSessionId, idleAttentionSessionIds, lastViewedRuntimeEventAtMsBySessionId, dismissedAttentionKeyBySessionId],
  );
  const projectById = useMemo(() => new Map(projects.map((project) => [project.id, project] as const)), [projects]);
  const divergenceById = useMemo(() => {
    const next = new Map<number, { branch: string; projectId: number }>();
    divergencesByProject.forEach((divergences) => {
      divergences.forEach((divergence) => {
        next.set(divergence.id, {
          branch: divergence.branch,
          projectId: divergence.projectId,
        });
      });
    });
    return next;
  }, [divergencesByProject]);
  const workspaceById = useMemo(() => new Map(workspaces.map((workspace) => [workspace.id, workspace] as const)), [workspaces]);
  const workspaceDivergenceById = useMemo(() => {
    const next = new Map<number, { branch: string; workspaceId: number }>();
    workspaceDivergencesByWorkspaceId.forEach((workspaceDivergences, workspaceId) => {
      workspaceDivergences.forEach((workspaceDivergence) => {
        next.set(workspaceDivergence.id, {
          branch: workspaceDivergence.branch,
          workspaceId,
        });
      });
    });
    return next;
  }, [workspaceDivergencesByWorkspaceId]);
  const needsAttentionItems = useMemo(
    () => buildSidebarNeedsAttentionItems(sessions.values(), sidebarAttentionOptions),
    [sessions, sidebarAttentionOptions],
  );

  const getAttentionBadgeClass = (tone: WorkspaceSessionAttentionState["tone"]): string => {
    switch (tone) {
      case "danger":
        return "bg-red/15 text-red border border-red/30";
      case "warning":
        return "bg-yellow/15 text-yellow border border-yellow/30";
      case "accent":
        return "bg-accent/15 text-accent border border-accent/30";
      case "success":
      default:
        return "bg-emerald-400/15 text-emerald-200 border border-emerald-400/30";
    }
  };

  const getAttentionDotClass = (tone: WorkspaceSessionAttentionState["tone"]): string => {
    switch (tone) {
      case "danger":
        return "bg-red";
      case "warning":
        return "bg-yellow";
      case "accent":
        return "bg-accent";
      case "success":
      default:
        return "bg-emerald-300";
    }
  };

  const getAttentionRowClass = (
    attentionState: WorkspaceSessionAttentionState | null,
    isActive: boolean,
  ): string => {
    if (!attentionState) {
      return isActive
        ? "bg-surface text-text"
        : "text-subtext hover:text-text hover:bg-surface/50";
    }

    const activePrefix = isActive ? "bg-surface text-text" : "text-text";
    switch (attentionState.tone) {
      case "danger":
        return `${activePrefix} ring-1 ring-red/35 ${isActive ? "" : "bg-red/10 hover:bg-red/15"}`;
      case "warning":
        return `${activePrefix} ring-1 ring-yellow/30 ${isActive ? "" : "bg-yellow/10 hover:bg-yellow/15"}`;
      case "accent":
        return `${activePrefix} ring-1 ring-accent/30 ${isActive ? "" : "bg-accent/10 hover:bg-accent/15"}`;
      case "success":
      default:
        return `${activePrefix} ring-1 ring-emerald-400/25 ${isActive ? "" : "bg-emerald-400/10 hover:bg-emerald-400/15"}`;
    }
  };

  const formatAttentionSummaryLabel = (
    attentionState: WorkspaceSessionAttentionState,
    count: number,
  ): string => {
    if (count <= 1) {
      return attentionState.label;
    }
    return `${attentionState.label} ${count}`;
  };

  const getDismissActionLabel = (attentionState: WorkspaceSessionAttentionState): string => (
    attentionState.kind === "approval-required" || attentionState.kind === "awaiting-input"
      ? "Snooze Reminder"
      : "Acknowledge"
  );

  const getSessionTargetLabel = (session: WorkspaceSession): string => {
    if (isAgentSession(session)) {
      switch (session.targetType) {
        case "project":
          return projectById.get(session.projectId)?.name ?? session.name;
        case "divergence": {
          const divergence = divergenceById.get(session.targetId);
          const projectName = projectById.get(divergence?.projectId ?? session.projectId)?.name ?? "Project";
          return `${projectName} / ${divergence?.branch ?? session.name}`;
        }
        case "workspace":
          return workspaceById.get(session.targetId)?.name ?? session.name;
        case "workspace_divergence": {
          const workspaceDivergence = workspaceDivergenceById.get(session.targetId);
          const workspaceName = workspaceById.get(workspaceDivergence?.workspaceId ?? session.workspaceOwnerId ?? -1)?.name ?? "Workspace";
          return `${workspaceName} / ${workspaceDivergence?.branch ?? session.name}`;
        }
      }
    }

    switch (session.type) {
      case "project":
        return projectById.get(session.projectId)?.name ?? session.name;
      case "divergence": {
        const divergence = divergenceById.get(session.targetId);
        const projectName = projectById.get(divergence?.projectId ?? session.projectId)?.name ?? "Project";
        return `${projectName} / ${divergence?.branch ?? session.name}`;
      }
      case "workspace":
        return workspaceById.get(session.targetId)?.name ?? session.name;
      case "workspace_divergence": {
        const workspaceDivergence = workspaceDivergenceById.get(session.targetId);
        const workspaceName = workspaceById.get(workspaceDivergence?.workspaceId ?? session.workspaceOwnerId ?? -1)?.name ?? "Workspace";
        return `${workspaceName} / ${workspaceDivergence?.branch ?? session.name}`;
      }
    }

    return session.name;
  };

  const renderSessionContextMenuContent = (
    session: WorkspaceSession,
    attentionState: WorkspaceSessionAttentionState | null,
  ) => (
    <ContextMenuContent>
      {attentionState && (
        <>
          <ContextMenuItem onSelect={() => onDismissSessionAttention(session.id)}>
            {getDismissActionLabel(attentionState)}
          </ContextMenuItem>
          <ContextMenuSeparator />
        </>
      )}
      {isAgentSession(session) ? (
        <>
          {session.isOpen ? (
            <ContextMenuItem onSelect={() => onCloseSession(session.id)}>
              Close Tab
            </ContextMenuItem>
          ) : (
            <ContextMenuItem onSelect={() => onSelectSession(session.id)}>
              Open Conversation
            </ContextMenuItem>
          )}
          <ContextMenuItem onSelect={() => onRenameAgentSession(session.id)}>
            Rename Conversation
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem className="text-red focus:text-red" onSelect={() => onDeleteAgentSession(session.id)}>
            Delete Conversation
          </ContextMenuItem>
        </>
      ) : (
        <>
          <ContextMenuItem className="text-red focus:text-red" onSelect={() => onCloseSession(session.id)}>
            Close Session
          </ContextMenuItem>
          {session.useTmux && (
            <ContextMenuItem className="text-red focus:text-red" onSelect={() => { void onCloseSessionAndKillTmux(session.id); }}>
              Close Session + Kill Tmux
            </ContextMenuItem>
          )}
        </>
      )}
    </ContextMenuContent>
  );

  return (
    <>
      <aside className={`w-full h-full bg-sidebar flex flex-col ${isCollapsed ? "" : "border-r border-surface"}`}>
        <div className="p-4 border-b border-surface space-y-3">
          <h1 className="text-lg font-semibold text-text flex items-center gap-2">
            <svg
              className="w-6 h-6 text-accent"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
            Divergence
          </h1>
          <SegmentedControl
            items={[
              { id: "projects" as const, label: "Projects" },
              { id: "work" as const, label: "Work" },
              { id: "workspaces" as const, label: "Workspaces" },
            ]}
            value={mode}
            onChange={onModeChange}
          />
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {mode === "projects" && deletingDivergences.length > 0 && (
            <div className="px-2 py-2 mb-2 text-xs text-subtext border border-surface rounded-md bg-surface/30 flex items-center gap-2">
              <svg className="w-3 h-3 animate-spin text-accent" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                <path className="opacity-90" fill="currentColor" d="M22 12a10 10 0 00-10-10v4a6 6 0 016 6h4z" />
              </svg>
              <span>
                {deletingDivergences.length === 1
                  ? `Deleting divergence: ${deletingDivergences[0]?.branch ?? ""}`
                  : `Deleting ${deletingDivergences.length} divergences`}
              </span>
            </div>
          )}
          {mode === "projects" && deleteError && (
            <ErrorBanner className="px-2 mb-2 rounded-md">
              Failed to delete divergence: {deleteError}
            </ErrorBanner>
          )}
          {mode !== "work" && needsAttentionItems.length > 0 && (
            <div className="mb-3 rounded-xl border border-surface/80 bg-main/35 px-2 py-2">
              <div className="flex items-center justify-between px-1 pb-2">
                <div className="text-[10px] uppercase tracking-[0.18em] text-subtext font-medium">
                  Needs You
                </div>
                <span className="text-[10px] text-subtext">
                  {needsAttentionItems.length}
                </span>
              </div>
              <div className="space-y-1">
                {needsAttentionItems.slice(0, NEEDS_ATTENTION_PREVIEW_LIMIT).map(({ session, attentionState }) => (
                  <ContextMenu key={session.id}>
                    <ContextMenuTrigger asChild>
                      <Button
                        type="button"
                        className={`w-full justify-start gap-2 rounded-md px-2 py-2 text-left transition-colors ${getAttentionRowClass(attentionState, session.id === activeSessionId)}`}
                        onClick={() => onRevealSession(session.id)}
                        variant="ghost"
                        size="sm"
                      >
                        <div className={`h-2.5 w-2.5 shrink-0 rounded-full ${getAttentionDotClass(attentionState.tone)} ${attentionState.pulse ? "animate-pulse" : ""}`} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className={`text-[9px] uppercase px-1 py-0.5 rounded shrink-0 ${getAttentionBadgeClass(attentionState.tone)}`}>
                              {attentionState.label}
                            </span>
                            {isAgentSession(session) ? (
                              <span className={`text-[9px] uppercase px-1 py-0.5 rounded shrink-0 ${getAgentProviderBadgeClass(session.provider)}`}>
                                {getAgentProviderLabel(session.provider)}
                              </span>
                            ) : (
                              <span className="text-[9px] uppercase px-1 py-0.5 rounded shrink-0 bg-surface text-subtext">
                                {session.useTmux ? "tmux" : "shell"}
                              </span>
                            )}
                            {isAgentSession(session) && !session.isOpen && (
                              <span className="text-[9px] uppercase px-1 py-0.5 rounded border border-surface bg-main text-subtext shrink-0">
                                saved
                              </span>
                            )}
                          </div>
                          <p className="mt-1 truncate text-xs text-text">{session.name}</p>
                          <p className="truncate text-[10px] text-subtext">{getSessionTargetLabel(session)}</p>
                        </div>
                      </Button>
                    </ContextMenuTrigger>
                    {renderSessionContextMenuContent(session, attentionState)}
                  </ContextMenu>
                ))}
                {needsAttentionItems.length > NEEDS_ATTENTION_PREVIEW_LIMIT && (
                  <p className="px-1 pt-1 text-[10px] text-subtext">
                    +{needsAttentionItems.length - NEEDS_ATTENTION_PREVIEW_LIMIT} more item{needsAttentionItems.length - NEEDS_ATTENTION_PREVIEW_LIMIT === 1 ? "" : "s"}
                  </p>
                )}
              </div>
            </div>
          )}
          {mode === "work" ? (
            <div className="space-y-1">
              <div className="px-2 py-2 text-xs uppercase text-subtext font-medium">
                Work
              </div>
              {WORK_NAV_ITEMS.map((item) => {
                const isActive = workTab === item.id;
                const badgeCount = item.id === "inbox"
                  ? inboxUnreadCount
                  : item.id === "task_center"
                    ? taskRunningCount
                    : 0;

                return (
                  <Button
                    key={item.id}
                    type="button"
                    onClick={() => onWorkTabChange(item.id)}
                    variant={isActive ? "secondary" : "ghost"}
                    size="sm"
                    className={`w-full text-left flex items-center justify-between gap-2 px-2 py-2 rounded transition-colors ${
                      isActive ? "bg-surface text-text" : "text-subtext hover:text-text hover:bg-surface/50"
                    }`}
                  >
                    <span className="text-sm">{item.label}</span>
                    {badgeCount > 0 && (
                      <span className="inline-flex min-w-[18px] h-5 items-center justify-center px-1.5 rounded-full text-[11px] bg-accent/20 text-accent">
                        {badgeCount}
                      </span>
                    )}
                  </Button>
                );
              })}
            </div>
          ) : mode === "workspaces" ? (
            <>
              <div className="flex items-center justify-between px-2 py-2">
                <div className="text-xs uppercase text-subtext font-medium">
                  Workspaces
                </div>
              </div>

              {workspaces.length === 0 ? (
                <EmptyState className="px-2">
                  <p>No workspaces yet</p>
                  <p className="text-xs mt-1">Click "Create Workspace" to group projects</p>
                </EmptyState>
              ) : (
                <div className="space-y-1">
                  {workspaces.map((workspace) => {
                    const members = membersByWorkspaceId.get(workspace.id) ?? [];
                    const memberCount = members.length;
                    const wsDivergences = workspaceDivergencesByWorkspaceId.get(workspace.id) ?? [];
                    const hasWsDivergences = wsDivergences.length > 0;
                    const isWsExpanded = expandedWorkspaces.has(workspace.id);
                    const workspaceSessions = getSessionsForWorkspace(sessions, "workspace", workspace.id);
                    const workspaceAttention = getSidebarAttentionSummary(workspaceSessions, sidebarAttentionOptions);
                    const workspaceActive = isSessionActive(activeSessionId, sessions, "workspace", workspace.id);
                    const workspaceStatus = getSessionStatus(sessions, "workspace", workspace.id);

                    return (
                      <div key={workspace.id}>
                        <ContextMenu>
                          <ContextMenuTrigger asChild>
                            <div
                              className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer group transition-colors ${getAttentionRowClass(workspaceAttention?.state ?? null, workspaceActive)}`}
                              onClick={() => onSelectWorkspace(workspace)}
                            >
                              {hasWsDivergences ? (
                                <IconButton
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    onToggleWorkspaceExpand(workspace.id);
                                  }}
                                  className="w-4 h-4 flex items-center justify-center text-subtext hover:text-text"
                                  variant="ghost"
                                  size="xs"
                                  label={isWsExpanded ? "Collapse workspace" : "Expand workspace"}
                                  icon={(
                                    <svg
                                      className={`w-3 h-3 transition-transform ${isWsExpanded ? "rotate-90" : ""}`}
                                      fill="none"
                                      stroke="currentColor"
                                      viewBox="0 0 24 24"
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M9 5l7 7-7 7"
                                      />
                                    </svg>
                                  )}
                                />
                              ) : (
                                <div className="w-4" />
                              )}
                              {workspaceAttention ? (
                                <div className={`h-2.5 w-2.5 shrink-0 rounded-full ${getAttentionDotClass(workspaceAttention.state.tone)} ${workspaceAttention.state.pulse ? "animate-pulse" : ""}`} />
                              ) : (
                                <StatusIndicator status={workspaceStatus} />
                              )}
                              <svg
                                className="w-4 h-4 text-accent shrink-0"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                                />
                              </svg>
                              <span className="flex-1 truncate text-sm text-text">
                                {workspace.name}
                              </span>
                              <span className="text-[11px] text-subtext bg-surface px-1.5 py-0.5 rounded-full">
                                {memberCount}
                              </span>
                              {workspaceAttention && (
                                <span className={`text-[10px] uppercase px-1.5 py-0.5 rounded ${getAttentionBadgeClass(workspaceAttention.state.tone)} ${workspaceAttention.state.pulse ? "animate-pulse" : ""}`}>
                                  {formatAttentionSummaryLabel(workspaceAttention.state, workspaceAttention.count)}
                                </span>
                              )}
                            </div>
                          </ContextMenuTrigger>
                          <ContextMenuContent>
                            <ContextMenuItem onSelect={() => onSelectWorkspace(workspace)}>
                              Open Terminal
                            </ContextMenuItem>
                            {agentProviders.map((provider) => (
                              <ContextMenuItem
                                key={provider}
                                onSelect={() => { void onCreateAgentSession({ provider, type: "workspace", item: workspace }); }}
                              >
                                Open {getAgentProviderLabel(provider)} Agent
                              </ContextMenuItem>
                            ))}
                            <ContextMenuItem onSelect={() => onOpenWorkspaceSettings(workspace)}>
                              Settings
                            </ContextMenuItem>
                            <ContextMenuItem onSelect={() => onCreateWorkspaceDivergence(workspace)}>
                              Create Divergence
                            </ContextMenuItem>
                            <ContextMenuSeparator />
                            <ContextMenuItem className="text-red focus:text-red" onSelect={() => { void onDeleteWorkspace(workspace); }}>
                              Delete Workspace
                            </ContextMenuItem>
                          </ContextMenuContent>
                        </ContextMenu>
                        <AnimatePresence initial={false}>
                          {isWsExpanded && hasWsDivergences && (
                            <motion.div
                              className="overflow-hidden"
                              variants={collapseVariants}
                              initial="hidden"
                              animate="visible"
                              exit="exit"
                              transition={layoutTransition}
                            >
                              <div className="ml-4 mt-1 space-y-1">
                                {wsDivergences.map((wd) => (
                                  (() => {
                                    const workspaceDivergenceSessions = getSessionsForWorkspace(
                                      sessions,
                                      "workspace_divergence",
                                      wd.id,
                                    );
                                    const workspaceDivergenceAttention = getSidebarAttentionSummary(
                                      workspaceDivergenceSessions,
                                      sidebarAttentionOptions,
                                    );
                                    const workspaceDivergenceActive = isSessionActive(
                                      activeSessionId,
                                      sessions,
                                      "workspace_divergence",
                                      wd.id,
                                    );
                                    const workspaceDivergenceStatus = getSessionStatus(
                                      sessions,
                                      "workspace_divergence",
                                      wd.id,
                                    );
                                    return (
                                  <ContextMenu key={wd.id}>
                                    <ContextMenuTrigger asChild>
                                      <div
                                        className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer transition-colors ${getAttentionRowClass(workspaceDivergenceAttention?.state ?? null, workspaceDivergenceActive)}`}
                                        onClick={() => onSelectWorkspaceDivergence(wd)}
                                      >
                                        <div className="w-4" />
                                        {workspaceDivergenceAttention ? (
                                          <div className={`h-2.5 w-2.5 shrink-0 rounded-full ${getAttentionDotClass(workspaceDivergenceAttention.state.tone)} ${workspaceDivergenceAttention.state.pulse ? "animate-pulse" : ""}`} />
                                        ) : (
                                          <StatusIndicator status={workspaceDivergenceStatus} />
                                        )}
                                        <svg
                                          className="w-4 h-4 text-accent shrink-0"
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
                                        <span className="flex-1 truncate text-sm text-text">
                                          {wd.branch}
                                        </span>
                                        {workspaceDivergenceAttention && (
                                          <span className={`text-[10px] uppercase px-1.5 py-0.5 rounded ${getAttentionBadgeClass(workspaceDivergenceAttention.state.tone)} ${workspaceDivergenceAttention.state.pulse ? "animate-pulse" : ""}`}>
                                            {formatAttentionSummaryLabel(workspaceDivergenceAttention.state, workspaceDivergenceAttention.count)}
                                          </span>
                                        )}
                                      </div>
                                    </ContextMenuTrigger>
                                    <ContextMenuContent>
                                      <ContextMenuItem onSelect={() => onSelectWorkspaceDivergence(wd)}>
                                        Open Terminal
                                      </ContextMenuItem>
                                      {agentProviders.map((provider) => (
                                        <ContextMenuItem
                                          key={provider}
                                          onSelect={() => { void onCreateAgentSession({ provider, type: "workspace_divergence", item: wd }); }}
                                        >
                                          Open {getAgentProviderLabel(provider)} Agent
                                        </ContextMenuItem>
                                      ))}
                                      <ContextMenuSeparator />
                                      <ContextMenuItem className="text-red focus:text-red" onSelect={() => { void onDeleteWorkspaceDivergence(wd); }}>
                                        Delete
                                      </ContextMenuItem>
                                    </ContextMenuContent>
                                  </ContextMenu>
                                    );
                                  })()
                                ))}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            <>
              <div className="flex items-center justify-between px-2 py-2">
                <div className="text-xs uppercase text-subtext font-medium">
                  Projects
                </div>
                <Button
                  className="text-xs text-subtext hover:text-text disabled:opacity-50 disabled:cursor-default"
                  onClick={onToggleAllProjects}
                  disabled={!hasExpandableProjects}
                  title={isAllExpanded ? "Collapse all projects" : "Expand all projects"}
                  variant="ghost"
                  size="xs"
                >
                  {isAllExpanded ? "Collapse all" : "Expand all"}
                </Button>
              </div>

              {projects.length === 0 ? (
                <EmptyState className="px-2">
                  <p>No projects yet</p>
                  <p className="text-xs mt-1">Click "Add Project" to get started</p>
                </EmptyState>
              ) : (
                <div className="space-y-1">
                  {projects.map((project) => {
                const divergences = divergencesByProject.get(project.id) || [];
                const isExpanded = expandedProjects.has(project.id);
                const projectStatus = getSessionStatus(sessions, "project", project.id);
                const projectActive = isSessionActive(activeSessionId, sessions, "project", project.id);
                const projectSessions = getSessionsForWorkspace(sessions, "project", project.id);
                const projectAttention = getSidebarAttentionSummary(projectSessions, sidebarAttentionOptions);

                return (
                  <div key={project.id}>
                    <ContextMenu>
                      <ContextMenuTrigger asChild>
                        <motion.div
                          className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer group transition-colors ${getAttentionRowClass(projectAttention?.state ?? null, projectActive)}`}
                          onClick={() => onSelectProject(project)}
                          layout={shouldReduceMotion ? undefined : "position"}
                          transition={layoutTransition}
                        >
                          {divergences.length > 0 && (
                            <IconButton
                              onClick={(event) => {
                                event.stopPropagation();
                                onToggleProjectExpand(project.id);
                              }}
                              className="w-4 h-4 flex items-center justify-center text-subtext hover:text-text"
                              variant="ghost"
                              size="xs"
                              label={isExpanded ? "Collapse project" : "Expand project"}
                              icon={(
                                <svg
                                  className={`w-3 h-3 transition-transform ${isExpanded ? "rotate-90" : ""}`}
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M9 5l7 7-7 7"
                                  />
                                </svg>
                              )}
                            />
                          )}
                          {divergences.length === 0 && <div className="w-4" />}

                          {projectAttention ? (
                            <div className={`h-2.5 w-2.5 shrink-0 rounded-full ${getAttentionDotClass(projectAttention.state.tone)} ${projectAttention.state.pulse ? "animate-pulse" : ""}`} />
                          ) : (
                            <StatusIndicator status={projectStatus} />
                          )}

                          <span className="flex-1 truncate text-sm text-text">
                            {project.name}
                          </span>

                          {projectAttention && (
                            <span className={`text-[10px] uppercase px-1.5 py-0.5 rounded ${getAttentionBadgeClass(projectAttention.state.tone)} ${projectAttention.state.pulse ? "animate-pulse" : ""}`}>
                              {formatAttentionSummaryLabel(projectAttention.state, projectAttention.count)}
                            </span>
                          )}

                          <IconButton
                            onClick={(event) => {
                              event.stopPropagation();
                              onCreateDivergenceForChange(project);
                            }}
                            className="opacity-0 group-hover:opacity-100 w-5 h-5 flex items-center justify-center text-subtext hover:text-accent transition-opacity"
                            title="Create Divergence"
                            variant="ghost"
                            size="xs"
                            label={`Create divergence for ${project.name}`}
                            icon={(
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
                                  d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2"
                                />
                              </svg>
                            )}
                          />
                        </motion.div>
                      </ContextMenuTrigger>
                      <ContextMenuContent>
                        <ContextMenuItem onSelect={() => onCreateAdditionalSession("project", project)}>
                          New Session
                        </ContextMenuItem>
                              {agentProviders.map((provider) => (
                                <ContextMenuItem
                                  key={provider}
                                  onSelect={() => { void onCreateAgentSession({ provider, type: "project", item: project }); }}
                                >
                                  Open {getAgentProviderLabel(provider)} Agent
                                </ContextMenuItem>
                              ))}
                        <ContextMenuItem onSelect={() => onCreateDivergenceForChange(project)}>
                          Create Divergence
                        </ContextMenuItem>
                        <ContextMenuSeparator />
                        <ContextMenuItem className="text-red focus:text-red" onSelect={() => { void onRemoveProject(project.id); }}>
                          Remove Project
                        </ContextMenuItem>
                      </ContextMenuContent>
                    </ContextMenu>

                    <AnimatePresence initial={false}>
                      {isExpanded && divergences.length > 0 && (
                        <motion.div
                          className="overflow-hidden"
                          variants={collapseVariants}
                          initial="hidden"
                          animate="visible"
                          exit="exit"
                          transition={layoutTransition}
                        >
                          <motion.div
                            className="ml-4 mt-1 space-y-1"
                            layout={shouldReduceMotion ? undefined : "position"}
                            transition={layoutTransition}
                          >
                            {divergences.map((divergence) => {
                              const divStatus = getSessionStatus(sessions, "divergence", divergence.id);
                              const divActive = isSessionActive(activeSessionId, sessions, "divergence", divergence.id);
                              const divergenceSessions = getSessionsForWorkspace(
                                sessions,
                                "divergence",
                                divergence.id
                              );
                              const divergenceAttention = getSidebarAttentionSummary(
                                divergenceSessions,
                                sidebarAttentionOptions,
                              );

                              return (
                                <div key={divergence.id}>
                                  <ContextMenu>
                                    <ContextMenuTrigger asChild>
                                      <motion.div
                                        className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer transition-colors ${getAttentionRowClass(divergenceAttention?.state ?? null, divActive)}`}
                                        onClick={() => onSelectDivergence(divergence)}
                                        layout={shouldReduceMotion ? undefined : "position"}
                                        transition={layoutTransition}
                                      >
                                        <div className="w-4" />
                                        {divergenceAttention ? (
                                          <div className={`h-2.5 w-2.5 shrink-0 rounded-full ${getAttentionDotClass(divergenceAttention.state.tone)} ${divergenceAttention.state.pulse ? "animate-pulse" : ""}`} />
                                        ) : (
                                          <StatusIndicator status={divStatus} />
                                        )}
                                        <svg
                                          className="w-4 h-4 text-accent"
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
                                        <span className="flex-1 truncate text-sm text-text">
                                          {divergence.branch}
                                        </span>
                                        {divergenceAttention && (
                                          <span className={`text-[10px] uppercase px-1.5 py-0.5 rounded ${getAttentionBadgeClass(divergenceAttention.state.tone)} ${divergenceAttention.state.pulse ? "animate-pulse" : ""}`}>
                                            {formatAttentionSummaryLabel(divergenceAttention.state, divergenceAttention.count)}
                                          </span>
                                        )}
                                      </motion.div>
                                    </ContextMenuTrigger>
                                    <ContextMenuContent>
                                      <ContextMenuItem onSelect={() => onCreateAdditionalSession("divergence", divergence)}>
                                        New Session
                                      </ContextMenuItem>
                                        {agentProviders.map((provider) => (
                                          <ContextMenuItem
                                            key={provider}
                                            onSelect={() => { void onCreateAgentSession({ provider, type: "divergence", item: divergence }); }}
                                          >
                                            Open {getAgentProviderLabel(provider)} Agent
                                          </ContextMenuItem>
                                        ))}
                                      <ContextMenuSeparator />
                                      <ContextMenuItem
                                        className="text-red focus:text-red"
                                        disabled={deletingDivergenceIds.has(divergence.id)}
                                        onSelect={() => onDeleteDivergenceFromMenu(divergence)}
                                      >
                                        {deletingDivergenceIds.has(divergence.id) ? "Deleting..." : "Delete Divergence"}
                                      </ContextMenuItem>
                                    </ContextMenuContent>
                                  </ContextMenu>
                                  {divergenceSessions.length > 0 && (
                                    <div className="ml-8 mt-1 space-y-0.5">
                                      {divergenceSessions.map((session) => {
                                        const sessionAttention = getSidebarSessionAttentionState(session, sidebarAttentionOptions);
                                        const sessionActive = isSessionItemActive(activeSessionId, session.id);
                                        return (
                                        <ContextMenu key={session.id}>
                                          <ContextMenuTrigger asChild>
                                            <Button
                                              type="button"
                                              className={`w-full justify-start text-left flex items-center gap-2 px-2 py-1 rounded text-xs transition-colors ${getAttentionRowClass(sessionAttention, sessionActive)}`}
                                              onClick={() => onSelectSession(session.id)}
                                              variant="ghost"
                                              size="xs"
                                            >
                                              {sessionAttention && isWorkspaceSessionNeedsAttention(sessionAttention) ? (
                                                <div className={`h-2.5 w-2.5 shrink-0 rounded-full ${getAttentionDotClass(sessionAttention.tone)} ${sessionAttention.pulse ? "animate-pulse" : ""}`} />
                                              ) : (
                                                <StatusIndicator status={session.status} />
                                              )}
                                              {isAgentSession(session) && (
                                                <span className={`text-[9px] uppercase px-1 py-0.5 rounded ${getAgentProviderBadgeClass(session.provider)}`}>
                                                  {getAgentProviderLabel(session.provider)}
                                                </span>
                                              )}
                                              {isAgentSession(session) && (
                                                <span className="text-[9px] px-1 py-0.5 rounded bg-surface text-subtext">
                                                  {session.model}
                                                </span>
                                              )}
                                              {sessionAttention && (
                                                <span className={`text-[9px] uppercase px-1 py-0.5 rounded ${getAttentionBadgeClass(sessionAttention.tone)} ${sessionAttention.pulse ? "animate-pulse" : ""}`}>
                                                  {sessionAttention.label}
                                                </span>
                                              )}
                                              {isAgentSession(session) && !session.isOpen && (
                                                <span className="text-[9px] uppercase px-1 py-0.5 rounded border border-surface bg-main text-subtext">
                                                  saved
                                                </span>
                                              )}
                                              <span className="truncate">
                                                {isAgentSession(session) || session.sessionRole !== "default"
                                                  ? session.name
                                                  : "default"}
                                              </span>
                                            </Button>
                                          </ContextMenuTrigger>
                                          {renderSessionContextMenuContent(session, sessionAttention)}
                                        </ContextMenu>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </motion.div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                    {projectSessions.length > 0 && (
                      <div className="ml-10 mt-1 space-y-0.5">
                        {projectSessions.map((session) => {
                          const sessionAttention = getSidebarSessionAttentionState(session, sidebarAttentionOptions);
                          const sessionActive = isSessionItemActive(activeSessionId, session.id);
                          return (
                          <ContextMenu key={session.id}>
                            <ContextMenuTrigger asChild>
                              <Button
                                type="button"
                                className={`w-full justify-start text-left flex items-center gap-2 px-2 py-1 rounded text-xs transition-colors ${getAttentionRowClass(sessionAttention, sessionActive)}`}
                                onClick={() => onSelectSession(session.id)}
                                variant="ghost"
                                size="xs"
                              >
                                {sessionAttention && isWorkspaceSessionNeedsAttention(sessionAttention) ? (
                                  <div className={`h-2.5 w-2.5 shrink-0 rounded-full ${getAttentionDotClass(sessionAttention.tone)} ${sessionAttention.pulse ? "animate-pulse" : ""}`} />
                                ) : (
                                  <StatusIndicator status={session.status} />
                                )}
                                {isAgentSession(session) && (
                                  <span className={`text-[9px] uppercase px-1 py-0.5 rounded ${getAgentProviderBadgeClass(session.provider)}`}>
                                    {getAgentProviderLabel(session.provider)}
                                  </span>
                                )}
                                {isAgentSession(session) && (
                                  <span className="text-[9px] px-1 py-0.5 rounded bg-surface text-subtext">
                                    {session.model}
                                  </span>
                                )}
                                {sessionAttention && (
                                  <span className={`text-[9px] uppercase px-1 py-0.5 rounded ${getAttentionBadgeClass(sessionAttention.tone)} ${sessionAttention.pulse ? "animate-pulse" : ""}`}>
                                    {sessionAttention.label}
                                  </span>
                                )}
                                {isAgentSession(session) && !session.isOpen && (
                                  <span className="text-[9px] uppercase px-1 py-0.5 rounded border border-surface bg-main text-subtext">
                                    saved
                                  </span>
                                )}
                                <span className="truncate">
                                  {isAgentSession(session) || session.sessionRole !== "default"
                                    ? session.name
                                    : "default"}
                                </span>
                              </Button>
                            </ContextMenuTrigger>
                            {renderSessionContextMenuContent(session, sessionAttention)}
                          </ContextMenu>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
                  })}
                </div>
              )}
            </>
          )}
        </div>

        {mode === "projects" && (
          <div className="p-2 border-t border-surface">
            <Button
              className="w-full px-3 py-2 bg-surface hover:bg-surface/80 text-text text-sm rounded-md flex items-center justify-center gap-2 transition-colors"
              onClick={onAddProjectClick}
              variant="secondary"
              size="md"
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
                  d="M12 4v16m8-8H4"
                />
              </svg>
              Add Project
            </Button>
          </div>
        )}
        {mode === "workspaces" && (
          <div className="p-2 border-t border-surface">
            <Button
              className="w-full px-3 py-2 bg-surface hover:bg-surface/80 text-text text-sm rounded-md flex items-center justify-center gap-2 transition-colors"
              onClick={onCreateWorkspace}
              variant="secondary"
              size="md"
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
                  d="M12 4v16m8-8H4"
                />
              </svg>
              Create Workspace
            </Button>
          </div>
        )}
      </aside>

      <AnimatePresence>
        {mode === "projects" && createDivergenceFor && (
          <CreateDivergenceModal
            project={createDivergenceFor}
            onClose={() => onCreateDivergenceForChange(null)}
            onCreate={(branchName, useExistingBranch) =>
              onCreateDivergence(createDivergenceFor, branchName, useExistingBranch)
            }
          />
        )}
      </AnimatePresence>
    </>
  );
}

export default SidebarPresentational;
