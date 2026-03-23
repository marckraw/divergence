import type { AgentProvider, Project, Divergence, WorkspaceSession, Workspace, WorkspaceMember, WorkspaceDivergence } from "../../../entities";
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
  sessions: Map<string, WorkspaceSession>;
  activeSessionId: string | null;
  idleAttentionSessionIds: Set<string>;
  lastViewedRuntimeEventAtMsBySessionId?: Map<string, number>;
  dismissedAttentionKeyBySessionId?: Map<string, string>;
  createDivergenceFor: Project | null;
  onCreateDivergenceForChange: (project: Project | null) => void;
  onSelectProject: (project: Project) => void;
  onSelectDivergence: (divergence: Divergence) => void;
  onSelectSession: (sessionId: string) => void;
  onRevealSession: (sessionId: string) => void;
  onDismissSessionAttention: (sessionId: string) => void;
  onCloseSession: (sessionId: string) => void;
  onDeleteAgentSession: (sessionId: string) => void;
  onRenameAgentSession: (sessionId: string) => void;
  onCloseSessionAndKillTmux: (sessionId: string) => Promise<void>;
  onAddProject: (name: string, path: string) => Promise<void>;
  onRemoveProject: (id: number) => Promise<void>;
  onCreateDivergence: (project: Project, branchName: string, useExistingBranch: boolean) => Promise<void>;
  onCreateAdditionalSession: (
    type: "project" | "divergence",
    item: Project | Divergence
  ) => void;
  onCreateAgentSession: (input: {
    provider: AgentProvider;
    type: "project" | "divergence" | "workspace" | "workspace_divergence";
    item: Project | Divergence | Workspace | WorkspaceDivergence;
  }) => Promise<void>;
  onDeleteDivergence: (divergence: Divergence, origin: string) => Promise<void>;
  agentProviders: AgentProvider[];
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

export interface SidebarPresentationalProps extends SidebarProps {
  expandedProjects: Set<number>;
  deletingDivergences: SidebarDeleteState[];
  deleteError: string | null;
  hasExpandableProjects: boolean;
  isAllExpanded: boolean;
  onAddProjectClick: () => Promise<void>;
  onToggleProjectExpand: (projectId: number) => void;
  onToggleAllProjects: () => void;
  onDeleteDivergenceFromMenu: (divergence: Divergence) => void;
  expandedWorkspaces: Set<number>;
  onToggleWorkspaceExpand: (workspaceId: number) => void;
}
