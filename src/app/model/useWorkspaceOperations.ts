import { useCallback, useState } from "react";
import { buildWorkspaceDivergenceTerminalSession, buildWorkspaceTerminalSession } from "../../entities";
import type {
  PortAllocation,
  Project,
  RunBackgroundTask,
  TerminalSession,
  Workspace,
  WorkspaceDivergence,
} from "../../entities";
import {
  executeCreateWorkspace,
  executeDeleteWorkspace,
  executeDeleteWorkspaceDivergence,
  queueCreateWorkspaceDivergences,
} from "../../features/workspace-management";

interface UseWorkspaceOperationsParams {
  projects: Project[];
  appSettings: {
    tmuxHistoryLimit: number;
  };
  portAllocationByEntityKey: Map<string, PortAllocation>;
  runTask: RunBackgroundTask;
  refreshDivergences: () => Promise<void>;
  refreshWorkspaces: () => Promise<void>;
  refreshPortAllocations: () => Promise<void>;
  closeSessionsForWorkspace: (workspaceId: number) => void;
  closeSessionsForWorkspaceDivergence: (wdId: number) => void;
  handleCloseSession: (sessionId: string) => void;
  sessionsRef: React.MutableRefObject<Map<string, TerminalSession>>;
  setSessions: React.Dispatch<React.SetStateAction<Map<string, TerminalSession>>>;
  setActiveSessionId: React.Dispatch<React.SetStateAction<string | null>>;
}

interface UseWorkspaceOperationsResult {
  handleSelectWorkspace: (workspace: Workspace) => void;
  handleCreateWorkspace: (
    name: string,
    description: string,
    selectedProjectIds: number[]
  ) => Promise<void>;
  handleDeleteWorkspace: (workspace: Workspace) => Promise<void>;
  handleSelectWorkspaceDivergence: (wd: WorkspaceDivergence) => void;
  handleDeleteWorkspaceDivergence: (wd: WorkspaceDivergence) => Promise<void>;
  handleOpenWorkspaceSettings: (workspace: Workspace) => void;
  handleCreateWorkspaceDivergences: (
    workspace: Workspace,
    memberProjects: Project[],
    branchName: string,
    useExistingBranch: boolean
  ) => Promise<void>;
  activeWorkspaceSettingsId: number | null;
  setActiveWorkspaceSettingsId: React.Dispatch<React.SetStateAction<number | null>>;
}

export function useWorkspaceOperations({
  projects,
  appSettings,
  portAllocationByEntityKey,
  runTask,
  refreshDivergences,
  refreshWorkspaces,
  refreshPortAllocations,
  closeSessionsForWorkspace,
  closeSessionsForWorkspaceDivergence,
  handleCloseSession,
  sessionsRef,
  setSessions,
  setActiveSessionId,
}: UseWorkspaceOperationsParams): UseWorkspaceOperationsResult {
  const [activeWorkspaceSettingsId, setActiveWorkspaceSettingsId] = useState<
    number | null
  >(null);

  const handleSelectWorkspace = useCallback(
    (workspace: Workspace) => {
      const id = `workspace-${workspace.id}`;
      const existing = sessionsRef.current.get(id);
      if (existing) {
        setActiveSessionId(existing.id);
        return;
      }

      const session = buildWorkspaceTerminalSession({
        workspace,
        globalTmuxHistoryLimit: appSettings.tmuxHistoryLimit,
      });

      setSessions((previous) => {
        const next = new Map(previous);
        next.set(id, session);
        return next;
      });
      setActiveSessionId(session.id);
    },
    [appSettings.tmuxHistoryLimit, sessionsRef, setSessions, setActiveSessionId]
  );

  const handleCreateWorkspace = useCallback(
    async (
      name: string,
      description: string,
      selectedProjectIds: number[]
    ): Promise<void> => {
      const selectedProjects = projects.filter((p) =>
        selectedProjectIds.includes(p.id)
      );
      await executeCreateWorkspace({
        name,
        description,
        selectedProjects,
        runTask,
        refreshWorkspaces,
      });
    },
    [projects, refreshWorkspaces, runTask]
  );

  const handleDeleteWorkspace = useCallback(
    async (workspace: Workspace): Promise<void> => {
      await executeDeleteWorkspace({
        workspace,
        runTask,
        closeSessionsForWorkspace: () => {
          closeSessionsForWorkspace(workspace.id);

          const sessionsToClose = Array.from(sessionsRef.current.entries())
            .filter(([, s]) => s.type === "workspace" && s.targetId === workspace.id)
            .map(([sessionId]) => sessionId);
          sessionsToClose.forEach(handleCloseSession);
        },
        closeSessionsForWorkspaceDivergence,
        refreshWorkspaces,
        refreshPortAllocations,
      });
    },
    [
      closeSessionsForWorkspace,
      closeSessionsForWorkspaceDivergence,
      handleCloseSession,
      refreshPortAllocations,
      refreshWorkspaces,
      runTask,
      sessionsRef,
    ]
  );

  const handleSelectWorkspaceDivergence = useCallback(
    (wd: WorkspaceDivergence) => {
      const id = `workspace_divergence-${wd.id}`;
      const existing = sessionsRef.current.get(id);
      if (existing) {
        setActiveSessionId(existing.id);
        return;
      }

      const portAllocation =
        portAllocationByEntityKey.get(`workspace_divergence:${wd.id}`) ?? null;
      const session = buildWorkspaceDivergenceTerminalSession({
        workspaceDivergence: wd,
        globalTmuxHistoryLimit: appSettings.tmuxHistoryLimit,
        portAllocation,
      });

      setSessions((previous) => {
        const next = new Map(previous);
        next.set(id, session);
        return next;
      });
      setActiveSessionId(session.id);
    },
    [
      appSettings.tmuxHistoryLimit,
      portAllocationByEntityKey,
      sessionsRef,
      setSessions,
      setActiveSessionId,
    ]
  );

  const handleDeleteWorkspaceDivergence = useCallback(
    async (wd: WorkspaceDivergence): Promise<void> => {
      await executeDeleteWorkspaceDivergence({
        workspaceDivergence: wd,
        runTask,
        closeSessionsForWorkspaceDivergence,
        refreshWorkspaces,
        refreshPortAllocations,
      });
    },
    [
      closeSessionsForWorkspaceDivergence,
      refreshPortAllocations,
      refreshWorkspaces,
      runTask,
    ]
  );

  const handleOpenWorkspaceSettings = useCallback((workspace: Workspace) => {
    setActiveWorkspaceSettingsId(workspace.id);
  }, []);

  const handleCreateWorkspaceDivergences = useCallback(
    async (
      workspace: Workspace,
      memberProjects: Project[],
      branchName: string,
      useExistingBranch: boolean
    ): Promise<void> => {
      await queueCreateWorkspaceDivergences({
        workspace,
        memberProjects,
        branchName,
        useExistingBranch,
        runTask,
        refreshDivergences,
        refreshWorkspaces,
        refreshPortAllocations,
      });
    },
    [refreshDivergences, refreshPortAllocations, refreshWorkspaces, runTask]
  );

  return {
    handleSelectWorkspace,
    handleCreateWorkspace,
    handleDeleteWorkspace,
    handleSelectWorkspaceDivergence,
    handleDeleteWorkspaceDivergence,
    handleOpenWorkspaceSettings,
    handleCreateWorkspaceDivergences,
    activeWorkspaceSettingsId,
    setActiveWorkspaceSettingsId,
  };
}
