import type { MouseEvent } from "react";
import type { Project, Divergence, TerminalSession } from "../../../entities";

export interface SidebarProps {
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
  onDeleteDivergence: (divergence: Divergence, origin: string) => Promise<void>;
  isCollapsed: boolean;
}

export interface SidebarDeleteState {
  id: number;
  branch: string;
}

export interface SidebarContextMenuState {
  type: "project" | "divergence" | "session";
  id: number | string;
  x: number;
  y: number;
  item: Project | Divergence | TerminalSession;
}

export interface SidebarPresentationalProps extends SidebarProps {
  expandedProjects: Set<number>;
  deletingDivergence: SidebarDeleteState | null;
  deleteError: string | null;
  contextMenu: SidebarContextMenuState | null;
  hasExpandableProjects: boolean;
  isAllExpanded: boolean;
  onAddProjectClick: () => Promise<void>;
  onToggleProjectExpand: (projectId: number) => void;
  onToggleAllProjects: () => void;
  onContextMenuOpen: (
    event: MouseEvent,
    type: "project" | "divergence" | "session",
    item: Project | Divergence | TerminalSession
  ) => void;
  onContextMenuClose: () => void;
  onContextMenuRemoveProject: () => Promise<void>;
  onContextMenuDeleteDivergence: () => Promise<void>;
  onContextMenuCloseSession: () => void;
  onContextMenuCloseSessionAndKillTmux: () => Promise<void>;
}
