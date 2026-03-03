import { useCallback, useState } from "react";
import {
  queueCreateDivergence,
} from "../../features/create-divergence";
import { executeDeleteDivergence } from "../../features/delete-divergence";
import { executeRemoveProject } from "../../features/remove-project";
import {
  executeCreateWorkspace,
  executeDeleteWorkspace,
  queueCreateWorkspaceDivergences,
  executeDeleteWorkspaceDivergence,
} from "../../features/workspace-management";
import type {
  Project,
  Divergence,
  TerminalSession,
  Workspace,
  WorkspaceDivergence,
  RunBackgroundTask,
} from "../../entities";
import type { PortAllocation } from "../../entities/port-management";
import {
  buildWorkspaceTerminalSession,
  buildWorkspaceDivergenceTerminalSession,
} from "../lib/sessionBuilder.pure";

interface UseEntityOperationsParams {
  projects: Project[];
  projectsById: Map<number, { name: string }>;
  divergencesByProject: Map<number, Divergence[]>;
  appSettings: {
    tmuxHistoryLimit: number;
  };
  portAllocationByEntityKey: Map<string, PortAllocation>;
  runTask: RunBackgroundTask;
  addProject: (name: string, path: string) => Promise<void>;
  removeProject: (id: number) => Promise<void>;
  refreshDivergences: () => Promise<void>;
  refreshWorkspaces: () => Promise<void>;
  refreshPortAllocations: () => Promise<void>;
  closeSessionsForProject: (projectId: number) => void;
  closeSessionsForDivergence: (divergenceId: number) => void;
  closeSessionsForWorkspaceDivergence: (wdId: number) => void;
  handleCloseSession: (sessionId: string) => void;
  sessionsRef: React.MutableRefObject<Map<string, TerminalSession>>;
  setSessions: React.Dispatch<React.SetStateAction<Map<string, TerminalSession>>>;
  setActiveSessionId: React.Dispatch<React.SetStateAction<string | null>>;
}

interface UseEntityOperationsResult {
  handleAddProject: (name: string, path: string) => Promise<void>;
  handleRemoveProject: (id: number) => Promise<void>;
  handleCreateDivergence: (project: Project, branchName: string, useExistingBranch: boolean) => Promise<void>;
  handleDeleteDivergence: (divergence: Divergence, origin: string) => Promise<void>;
  handleSelectWorkspace: (workspace: Workspace) => void;
  handleCreateWorkspace: (name: string, description: string, selectedProjectIds: number[]) => Promise<void>;
  handleDeleteWorkspace: (workspace: Workspace) => Promise<void>;
  handleSelectWorkspaceDivergence: (wd: WorkspaceDivergence) => void;
  handleDeleteWorkspaceDivergence: (wd: WorkspaceDivergence) => Promise<void>;
  handleOpenWorkspaceSettings: (workspace: Workspace) => void;
  handleCreateWorkspaceDivergences: (workspace: Workspace, memberProjects: Project[], branchName: string, useExistingBranch: boolean) => Promise<void>;
  activeWorkspaceSettingsId: number | null;
  setActiveWorkspaceSettingsId: React.Dispatch<React.SetStateAction<number | null>>;
}

export function useEntityOperations({
  projects,
  projectsById,
  divergencesByProject,
  appSettings,
  portAllocationByEntityKey,
  runTask,
  addProject,
  removeProject,
  refreshDivergences,
  refreshWorkspaces,
  refreshPortAllocations,
  closeSessionsForProject,
  closeSessionsForDivergence,
  closeSessionsForWorkspaceDivergence,
  handleCloseSession,
  sessionsRef,
  setSessions,
  setActiveSessionId,
}: UseEntityOperationsParams): UseEntityOperationsResult {
  const [activeWorkspaceSettingsId, setActiveWorkspaceSettingsId] = useState<number | null>(null);

  const handleAddProject = useCallback(async (name: string, path: string) => {
    await addProject(name, path);
  }, [addProject]);

  const handleCreateDivergence = useCallback(async (
    project: Project,
    branchName: string,
    useExistingBranch: boolean
  ): Promise<void> => {
    return queueCreateDivergence({
      project,
      branchName,
      useExistingBranch,
      runTask,
      refreshDivergences,
      refreshPortAllocations,
    });
  }, [refreshDivergences, refreshPortAllocations, runTask]);

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
      refreshPortAllocations,
    });
  }, [closeSessionsForDivergence, projectsById, refreshDivergences, refreshPortAllocations, runTask]);

  const handleSelectWorkspace = useCallback((workspace: Workspace) => {
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
  }, [appSettings.tmuxHistoryLimit, sessionsRef, setSessions, setActiveSessionId]);

  const handleCreateWorkspace = useCallback(async (
    name: string,
    description: string,
    selectedProjectIds: number[],
  ): Promise<void> => {
    const selectedProjects = projects.filter((p) => selectedProjectIds.includes(p.id));
    await executeCreateWorkspace({
      name,
      description,
      selectedProjects,
      runTask,
      refreshWorkspaces,
    });
  }, [projects, refreshWorkspaces, runTask]);

  const handleDeleteWorkspace = useCallback(async (
    workspace: Workspace,
  ): Promise<void> => {
    await executeDeleteWorkspace({
      workspace,
      runTask,
      closeSessionsForWorkspace: () => {
        const sessionsToClose = Array.from(sessionsRef.current.entries())
          .filter(([, s]) => s.type === "workspace" && s.targetId === workspace.id)
          .map(([sessionId]) => sessionId);
        sessionsToClose.forEach(handleCloseSession);
      },
      closeSessionsForWorkspaceDivergence,
      refreshWorkspaces,
      refreshPortAllocations,
    });
  }, [
    closeSessionsForWorkspaceDivergence,
    handleCloseSession,
    refreshPortAllocations,
    refreshWorkspaces,
    runTask,
    sessionsRef,
  ]);

  const handleSelectWorkspaceDivergence = useCallback((wd: WorkspaceDivergence) => {
    const id = `workspace_divergence-${wd.id}`;
    const existing = sessionsRef.current.get(id);
    if (existing) {
      setActiveSessionId(existing.id);
      return;
    }

    const portAllocation = portAllocationByEntityKey.get(`workspace_divergence:${wd.id}`) ?? null;
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
  }, [appSettings.tmuxHistoryLimit, portAllocationByEntityKey, sessionsRef, setSessions, setActiveSessionId]);

  const handleDeleteWorkspaceDivergence = useCallback(async (
    wd: WorkspaceDivergence,
  ): Promise<void> => {
    await executeDeleteWorkspaceDivergence({
      workspaceDivergence: wd,
      runTask,
      closeSessionsForWorkspaceDivergence,
      refreshWorkspaces,
      refreshPortAllocations,
    });
  }, [closeSessionsForWorkspaceDivergence, refreshPortAllocations, refreshWorkspaces, runTask]);

  const handleOpenWorkspaceSettings = useCallback((workspace: Workspace) => {
    setActiveWorkspaceSettingsId(workspace.id);
  }, []);

  const handleCreateWorkspaceDivergences = useCallback(async (
    workspace: Workspace,
    memberProjects: Project[],
    branchName: string,
    useExistingBranch: boolean,
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
  }, [refreshDivergences, refreshPortAllocations, refreshWorkspaces, runTask]);

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

  return {
    handleAddProject,
    handleRemoveProject,
    handleCreateDivergence,
    handleDeleteDivergence,
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
