import { useState, useCallback, useEffect, useRef } from "react";
import type { MouseEvent } from "react";
import type { Divergence, Project, TerminalSession, Workspace, WorkspaceDivergence } from "../../../entities";
import { selectSingleDirectory } from "../../../shared/api/dialog.api";
import {
  areAllExpanded,
  getExpandableProjectIds,
  getProjectNameFromSelectedPath,
  toggleAllExpandedProjects,
  toggleExpandedProjectId,
} from "../lib/sidebar.pure";
import SidebarPresentational from "./Sidebar.presentational";
import type {
  SidebarContextMenuState,
  SidebarDeleteState,
  SidebarProps,
} from "./Sidebar.types";

function SidebarContainer({
  mode,
  projects,
  divergencesByProject,
  onAddProject,
  onRemoveProject,
  onCreateAdditionalSession,
  onDeleteDivergence,
  onCloseSession,
  onCloseSessionAndKillTmux,
  ...props
}: SidebarProps) {
  const [expandedProjects, setExpandedProjects] = useState<Set<number>>(new Set());
  const [expandedWorkspaces, setExpandedWorkspaces] = useState<Set<number>>(new Set());
  const hasUserToggledExpansion = useRef(false);
  const [deletingDivergences, setDeletingDivergences] = useState<SidebarDeleteState[]>([]);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<SidebarContextMenuState | null>(null);

  useEffect(() => {
    if (mode === "work" || mode === "workspaces") {
      setContextMenu(null);
      setDeletingDivergences([]);
      setDeleteError(null);
    }
  }, [mode]);

  useEffect(() => {
    if (hasUserToggledExpansion.current || projects.length === 0) {
      return;
    }

    const next = new Set<number>();
    let hasExpandableProjects = false;

    for (const project of projects) {
      const divergences = divergencesByProject.get(project.id) || [];
      if (divergences.length > 0) {
        next.add(project.id);
        hasExpandableProjects = true;
      }
    }

    if (hasExpandableProjects) {
      setExpandedProjects(next);
    }
  }, [divergencesByProject, projects]);

  const handleAddProjectClick = useCallback(async () => {
    try {
      const selected = await selectSingleDirectory("Select Project Folder");
      if (selected) {
        const name = getProjectNameFromSelectedPath(selected);
        await onAddProject(name, selected);
      }
    } catch (error) {
      console.error("Failed to add project:", error);
    }
  }, [onAddProject]);

  const handleToggleProjectExpand = useCallback((projectId: number) => {
    hasUserToggledExpansion.current = true;
    setExpandedProjects((previous) => toggleExpandedProjectId(previous, projectId));
  }, []);

  const expandableProjectIds = getExpandableProjectIds(projects, divergencesByProject);
  const hasExpandableProjects = expandableProjectIds.length > 0;
  const isAllExpanded = areAllExpanded(expandedProjects, expandableProjectIds);

  const handleToggleWorkspaceExpand = useCallback((workspaceId: number) => {
    setExpandedWorkspaces((prev) => {
      const next = new Set(prev);
      if (next.has(workspaceId)) {
        next.delete(workspaceId);
      } else {
        next.add(workspaceId);
      }
      return next;
    });
  }, []);

  const handleToggleAllProjects = useCallback(() => {
    hasUserToggledExpansion.current = true;
    setExpandedProjects((previous) => toggleAllExpandedProjects(previous, expandableProjectIds));
  }, [expandableProjectIds]);

  const handleContextMenuOpen = useCallback((
    event: MouseEvent,
    type: "project" | "divergence" | "session" | "workspace" | "workspace_divergence",
    item: Project | Divergence | TerminalSession | Workspace | WorkspaceDivergence
  ) => {
    event.preventDefault();
    setContextMenu({
      type,
      id: item.id,
      x: event.clientX,
      y: event.clientY,
      item,
    });
  }, []);

  const handleContextMenuClose = useCallback(() => {
    setContextMenu(null);
  }, []);

  const handleContextMenuRemoveProject = useCallback(async () => {
    if (contextMenu?.type === "project") {
      try {
        await onRemoveProject(contextMenu.id as number);
      } catch (error) {
        console.error("Failed to remove project:", error);
      }
    }
    handleContextMenuClose();
  }, [contextMenu, handleContextMenuClose, onRemoveProject]);

  const handleContextMenuCreateAdditionalSession = useCallback(() => {
    if (contextMenu?.type === "project" || contextMenu?.type === "divergence") {
      onCreateAdditionalSession(
        contextMenu.type,
        contextMenu.item as Project | Divergence
      );
    }
    handleContextMenuClose();
  }, [contextMenu, handleContextMenuClose, onCreateAdditionalSession]);

  const handleContextMenuDeleteDivergence = useCallback(() => {
    if (contextMenu?.type === "divergence") {
      const divergence = contextMenu.item as Divergence;
      const isAlreadyDeleting = deletingDivergences.some((item) => item.id === divergence.id);
      if (isAlreadyDeleting) {
        handleContextMenuClose();
        return;
      }

      setDeletingDivergences((previous) => [...previous, { id: divergence.id, branch: divergence.branch }]);
      setDeleteError(null);
      handleContextMenuClose();

      void onDeleteDivergence(divergence, "sidebar_context_menu")
        .catch((error) => {
          console.error("Failed to delete divergence:", error);
          setDeleteError(error instanceof Error ? error.message : String(error));
        })
        .finally(() => {
          setDeletingDivergences((current) => current.filter((item) => item.id !== divergence.id));
        });
      return;
    }

    handleContextMenuClose();
  }, [contextMenu, deletingDivergences, handleContextMenuClose, onDeleteDivergence]);

  const handleContextMenuCloseSession = useCallback(() => {
    if (contextMenu?.type === "session") {
      onCloseSession(contextMenu.id as string);
    }
    handleContextMenuClose();
  }, [contextMenu, handleContextMenuClose, onCloseSession]);

  const handleContextMenuCloseSessionAndKillTmux = useCallback(async () => {
    if (contextMenu?.type === "session") {
      try {
        await onCloseSessionAndKillTmux(contextMenu.id as string);
      } catch (error) {
        console.error("Failed to close session and kill tmux:", error);
      }
    }
    handleContextMenuClose();
  }, [contextMenu, handleContextMenuClose, onCloseSessionAndKillTmux]);

  return (
    <SidebarPresentational
      {...props}
      mode={mode}
      projects={projects}
      divergencesByProject={divergencesByProject}
      onAddProject={onAddProject}
      onRemoveProject={onRemoveProject}
      onCreateAdditionalSession={onCreateAdditionalSession}
      onDeleteDivergence={onDeleteDivergence}
      onCloseSession={onCloseSession}
      onCloseSessionAndKillTmux={onCloseSessionAndKillTmux}
      expandedProjects={expandedProjects}
      deletingDivergences={deletingDivergences}
      deleteError={deleteError}
      contextMenu={contextMenu}
      hasExpandableProjects={hasExpandableProjects}
      isAllExpanded={isAllExpanded}
      onAddProjectClick={handleAddProjectClick}
      onToggleProjectExpand={handleToggleProjectExpand}
      onToggleAllProjects={handleToggleAllProjects}
      onContextMenuOpen={handleContextMenuOpen}
      onContextMenuClose={handleContextMenuClose}
      onContextMenuRemoveProject={handleContextMenuRemoveProject}
      onContextMenuCreateAdditionalSession={handleContextMenuCreateAdditionalSession}
      onContextMenuDeleteDivergence={handleContextMenuDeleteDivergence}
      onContextMenuCloseSession={handleContextMenuCloseSession}
      onContextMenuCloseSessionAndKillTmux={handleContextMenuCloseSessionAndKillTmux}
      expandedWorkspaces={expandedWorkspaces}
      onToggleWorkspaceExpand={handleToggleWorkspaceExpand}
    />
  );
}

export default SidebarContainer;
