import type { MouseEvent } from "react";
import type { Project, Divergence, TerminalSession, Workspace, WorkspaceMember, WorkspaceDivergence } from "../../../entities";
import type { WorkSidebarMode, WorkSidebarTab } from "../../../features/work-sidebar";

export interface SidebarProps {
  mode: WorkSidebarMode;
  workTab: WorkSidebarTab;
  onModeChange: (mode: WorkSidebarMode) => void;
  onWorkTabChange: (tab: WorkSidebarTab) => void;
  inboxUnreadCount: number;
  taskRunningCount: number;
  projects: Project[];
  divergencesByProject: Map<number, Divergence[]>;
  sessions: Map<string, TerminalSession>;
  activeSessionId: string | null;
  createDivergenceFor: Project | null;
  onCreateDivergenceForChange: (project: Project | null) => void;
  onSelectProject: (project: Project) => void;
  onSelectDivergence: (divergence: Divergence) => void;
  onSelectSession: (sessionId: string) => void;
  onCloseSession: (sessionId: string) => void;
  onCloseSessionAndKillTmux: (sessionId: string) => Promise<void>;
  onAddProject: (name: string, path: string) => Promise<void>;
  onRemoveProject: (id: number) => Promise<void>;
  onCreateDivergence: (project: Project, branchName: string, useExistingBranch: boolean) => Promise<Divergence>;
  onCreateAdditionalSession: (
    type: "project" | "divergence",
    item: Project | Divergence
  ) => void;
  onDeleteDivergence: (divergence: Divergence, origin: string) => Promise<void>;
  isCollapsed: boolean;
  workspaces: Workspace[];
  membersByWorkspaceId: Map<number, WorkspaceMember[]>;
  onSelectWorkspace: (workspace: Workspace) => void;
  onCreateWorkspace: () => void;
  onDeleteWorkspace: (workspace: Workspace) => Promise<void>;
  onOpenWorkspaceSettings: (workspace: Workspace) => void;
  onCreateWorkspaceDivergence: (workspace: Workspace) => void;
  workspaceDivergencesByWorkspaceId: Map<number, WorkspaceDivergence[]>;
  onSelectWorkspaceDivergence: (wd: WorkspaceDivergence) => void;
  onDeleteWorkspaceDivergence: (wd: WorkspaceDivergence) => Promise<void>;
}

export interface SidebarDeleteState {
  id: number;
  branch: string;
}

export interface SidebarContextMenuState {
  type: "project" | "divergence" | "session" | "workspace" | "workspace_divergence";
  id: number | string;
  x: number;
  y: number;
  item: Project | Divergence | TerminalSession | Workspace | WorkspaceDivergence;
}

export interface SidebarPresentationalProps extends SidebarProps {
  expandedProjects: Set<number>;
  deletingDivergences: SidebarDeleteState[];
  deleteError: string | null;
  contextMenu: SidebarContextMenuState | null;
  hasExpandableProjects: boolean;
  isAllExpanded: boolean;
  onAddProjectClick: () => Promise<void>;
  onToggleProjectExpand: (projectId: number) => void;
  onToggleAllProjects: () => void;
  onContextMenuOpen: (
    event: MouseEvent,
    type: "project" | "divergence" | "session" | "workspace" | "workspace_divergence",
    item: Project | Divergence | TerminalSession | Workspace | WorkspaceDivergence
  ) => void;
  onContextMenuClose: () => void;
  onContextMenuRemoveProject: () => Promise<void>;
  onContextMenuCreateAdditionalSession: () => void;
  onContextMenuDeleteDivergence: () => void;
  onContextMenuCloseSession: () => void;
  onContextMenuCloseSessionAndKillTmux: () => Promise<void>;
  expandedWorkspaces: Set<number>;
  onToggleWorkspaceExpand: (workspaceId: number) => void;
}
