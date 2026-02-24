import { useState, useCallback, useEffect, useRef } from "react";
import type { Divergence } from "../../../entities";
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
  SidebarDeleteState,
  SidebarProps,
} from "./Sidebar.types";

function SidebarContainer({
  mode,
  projects,
  divergencesByProject,
  onAddProject,
  onDeleteDivergence,
  ...props
}: SidebarProps) {
  const [expandedProjects, setExpandedProjects] = useState<Set<number>>(new Set());
  const [expandedWorkspaces, setExpandedWorkspaces] = useState<Set<number>>(new Set());
  const hasUserToggledExpansion = useRef(false);
  const [deletingDivergences, setDeletingDivergences] = useState<SidebarDeleteState[]>([]);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    if (mode === "work" || mode === "workspaces") {
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

  const handleDeleteDivergenceFromMenu = useCallback((divergence: Divergence) => {
    const isAlreadyDeleting = deletingDivergences.some((item) => item.id === divergence.id);
    if (isAlreadyDeleting) {
      return;
    }

    setDeletingDivergences((previous) => [...previous, { id: divergence.id, branch: divergence.branch }]);
    setDeleteError(null);

    void onDeleteDivergence(divergence, "sidebar_context_menu")
      .catch((error) => {
        console.error("Failed to delete divergence:", error);
        setDeleteError(error instanceof Error ? error.message : String(error));
      })
      .finally(() => {
        setDeletingDivergences((current) => current.filter((item) => item.id !== divergence.id));
      });
  }, [deletingDivergences, onDeleteDivergence]);

  return (
    <SidebarPresentational
      {...props}
      mode={mode}
      projects={projects}
      divergencesByProject={divergencesByProject}
      onAddProject={onAddProject}
      onDeleteDivergence={onDeleteDivergence}
      expandedProjects={expandedProjects}
      deletingDivergences={deletingDivergences}
      deleteError={deleteError}
      hasExpandableProjects={hasExpandableProjects}
      isAllExpanded={isAllExpanded}
      onAddProjectClick={handleAddProjectClick}
      onToggleProjectExpand={handleToggleProjectExpand}
      onToggleAllProjects={handleToggleAllProjects}
      onDeleteDivergenceFromMenu={handleDeleteDivergenceFromMenu}
      expandedWorkspaces={expandedWorkspaces}
      onToggleWorkspaceExpand={handleToggleWorkspaceExpand}
    />
  );
}

export default SidebarContainer;
