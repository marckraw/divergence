import { useState, useCallback, useEffect, useRef } from "react";
import type { MouseEvent } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import type { Divergence, Project } from "../../../entities";
import {
  areAllExpanded,
  getExpandableProjectIds,
  getProjectNameFromSelectedPath,
  toggleAllExpandedProjects,
  toggleExpandedProjectId,
} from "../../../lib/utils/sidebar";
import SidebarPresentational from "./Sidebar.presentational";
import type {
  SidebarContextMenuState,
  SidebarDeleteState,
  SidebarProps,
} from "./Sidebar.types";

function SidebarContainer({
  projects,
  divergencesByProject,
  onAddProject,
  onRemoveProject,
  onDeleteDivergence,
  ...props
}: SidebarProps) {
  const [expandedProjects, setExpandedProjects] = useState<Set<number>>(new Set());
  const hasUserToggledExpansion = useRef(false);
  const [deletingDivergence, setDeletingDivergence] = useState<SidebarDeleteState | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<SidebarContextMenuState | null>(null);

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
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Select Project Folder",
      });

      if (selected && typeof selected === "string") {
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

  const handleToggleAllProjects = useCallback(() => {
    hasUserToggledExpansion.current = true;
    setExpandedProjects((previous) => toggleAllExpandedProjects(previous, expandableProjectIds));
  }, [expandableProjectIds]);

  const handleContextMenuOpen = useCallback((
    event: MouseEvent,
    type: "project" | "divergence",
    item: Project | Divergence
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
        await onRemoveProject(contextMenu.id);
      } catch (error) {
        console.error("Failed to remove project:", error);
      }
    }
    handleContextMenuClose();
  }, [contextMenu, handleContextMenuClose, onRemoveProject]);

  const handleContextMenuDeleteDivergence = useCallback(async () => {
    if (contextMenu?.type === "divergence") {
      const divergence = contextMenu.item as Divergence;
      setDeletingDivergence({ id: divergence.id, branch: divergence.branch });
      setDeleteError(null);

      try {
        await onDeleteDivergence(divergence, "sidebar_context_menu");
        handleContextMenuClose();
      } catch (error) {
        console.error("Failed to delete divergence:", error);
        setDeleteError(error instanceof Error ? error.message : String(error));
      } finally {
        setDeletingDivergence((current) => (current?.id === divergence.id ? null : current));
      }
      return;
    }

    handleContextMenuClose();
  }, [contextMenu, handleContextMenuClose, onDeleteDivergence]);

  return (
    <SidebarPresentational
      {...props}
      projects={projects}
      divergencesByProject={divergencesByProject}
      onAddProject={onAddProject}
      onRemoveProject={onRemoveProject}
      onDeleteDivergence={onDeleteDivergence}
      expandedProjects={expandedProjects}
      deletingDivergence={deletingDivergence}
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
      onContextMenuDeleteDivergence={handleContextMenuDeleteDivergence}
    />
  );
}

export default SidebarContainer;
