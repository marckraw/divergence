import { useCallback } from "react";
import type {
  AgentSessionSnapshot,
  BackgroundTask,
  PortAllocation,
  Project,
  TerminalSession,
} from "../../../entities";
import {
  buildTerminalSession,
  buildWorkspaceKey,
  generateSessionEntropy,
} from "../../../entities";
import type { ProjectSettings } from "../../../entities/project";
import type { WorkSidebarMode, WorkSidebarTab } from "../../work-sidebar";

interface UseTaskCenterAttachmentParams {
  viewTask: (taskId: string) => void;
  setIsSidebarOpen: (open: boolean) => void;
  setSidebarMode: React.Dispatch<React.SetStateAction<WorkSidebarMode>>;
  setWorkTab: (tab: WorkSidebarTab) => void;
  projectById: Map<number, Project>;
  settingsByProjectId: Map<number, ProjectSettings>;
  projectsById: Map<number, { name: string }>;
  appSettings: {
    tmuxHistoryLimit: number;
  };
  portAllocationByEntityKey: Map<string, PortAllocation>;
  agentSessions: Map<string, AgentSessionSnapshot>;
  setSessions: React.Dispatch<React.SetStateAction<Map<string, TerminalSession>>>;
  setActiveSessionId: React.Dispatch<React.SetStateAction<string | null>>;
  sendCommandToSession: (
    sessionId: string,
    command: string,
    options?: { timeoutMs?: number; activateIfNeeded?: boolean }
  ) => Promise<void>;
}

interface UseTaskCenterAttachmentResult {
  handleViewTaskCenterTask: (taskId: string) => void;
  handleAttachToAutomationSession: (task: BackgroundTask) => Promise<void>;
}

export function useTaskCenterAttachment({
  viewTask,
  setIsSidebarOpen,
  setSidebarMode,
  setWorkTab,
  projectById,
  settingsByProjectId,
  projectsById,
  appSettings,
  portAllocationByEntityKey,
  agentSessions,
  setSessions,
  setActiveSessionId,
  sendCommandToSession,
}: UseTaskCenterAttachmentParams): UseTaskCenterAttachmentResult {
  const handleViewTaskCenterTask = useCallback(
    (taskId: string) => {
      viewTask(taskId);
      setIsSidebarOpen(true);
      setSidebarMode("work");
      setWorkTab("task_center");
    },
    [viewTask, setIsSidebarOpen, setSidebarMode, setWorkTab]
  );

  const handleAttachToAutomationSession = useCallback(
    async (task: BackgroundTask) => {
      if (
        task.target.agentSessionId &&
        agentSessions.has(task.target.agentSessionId)
      ) {
        setActiveSessionId(task.target.agentSessionId);
        setSidebarMode("projects");
        return;
      }

      const { tmuxSessionName, projectId, path } = task.target;
      if (!tmuxSessionName || !projectId || !path) return;

      const project = projectById.get(projectId);
      if (!project) return;

      const entropy = generateSessionEntropy();
      const sessionId = `project-${projectId}#automation-${entropy}`;
      const portAlloc =
        portAllocationByEntityKey.get(`project:${projectId}`) ?? null;
      const base = buildTerminalSession({
        type: "project",
        target: project,
        settingsByProjectId,
        projectsById,
        globalTmuxHistoryLimit: appSettings.tmuxHistoryLimit,
        portAllocation: portAlloc,
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

      const escapedName = tmuxSessionName.replace(/'/g, "'\\''");
      const attachCommand = `tmux select-window -t '${escapedName}':0 2>/dev/null; exec tmux attach -t '${escapedName}'`;
      try {
        await sendCommandToSession(session.id, attachCommand, {
          activateIfNeeded: false,
        });
      } catch (err) {
        console.warn("Failed to attach to automation tmux session:", err);
      }
    },
    [
      agentSessions,
      projectById,
      settingsByProjectId,
      projectsById,
      appSettings.tmuxHistoryLimit,
      portAllocationByEntityKey,
      sendCommandToSession,
      setSessions,
      setActiveSessionId,
      setSidebarMode,
    ]
  );

  return {
    handleViewTaskCenterTask,
    handleAttachToAutomationSession,
  };
}
