import { useState, useCallback, useEffect, useRef } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import type { Project, Divergence, TerminalSession } from "../types";
import StatusIndicator from "./StatusIndicator";
import CreateDivergenceModal from "./CreateDivergenceModal";
import { buildTmuxSessionName, buildLegacyTmuxSessionName, buildSplitTmuxSessionName } from "../lib/tmux";

interface SidebarProps {
  projects: Project[];
  divergencesByProject: Map<number, Divergence[]>;
  sessions: Map<string, TerminalSession>;
  activeSessionId: string | null;
  onSelectProject: (project: Project) => void;
  onSelectDivergence: (divergence: Divergence) => void;
  onAddProject: (name: string, path: string) => Promise<void>;
  onRemoveProject: (id: number) => Promise<void>;
  onDivergenceCreated: () => void;
  onDeleteDivergence: (id: number) => Promise<void>;
}

function Sidebar({
  projects,
  divergencesByProject,
  sessions,
  activeSessionId,
  onSelectProject,
  onSelectDivergence,
  onAddProject,
  onRemoveProject,
  onDivergenceCreated,
  onDeleteDivergence,
}: SidebarProps) {
  const [expandedProjects, setExpandedProjects] = useState<Set<number>>(new Set());
  const hasUserToggledExpansion = useRef(false);
  const [contextMenu, setContextMenu] = useState<{
    type: "project" | "divergence";
    id: number;
    x: number;
    y: number;
    item: Project | Divergence;
  } | null>(null);
  const [createDivergenceFor, setCreateDivergenceFor] = useState<Project | null>(null);

  useEffect(() => {
    if (hasUserToggledExpansion.current) {
      return;
    }
    if (projects.length === 0) {
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
  }, [projects, divergencesByProject]);

  const handleAddProject = useCallback(async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Select Project Folder",
      });

      if (selected && typeof selected === "string") {
        const name = selected.split("/").pop() || "Unnamed Project";
        await onAddProject(name, selected);
      }
    } catch (err) {
      console.error("Failed to add project:", err);
    }
  }, [onAddProject]);

  const toggleExpand = useCallback((projectId: number) => {
    hasUserToggledExpansion.current = true;
    setExpandedProjects(prev => {
      const next = new Set(prev);
      if (next.has(projectId)) {
        next.delete(projectId);
      } else {
        next.add(projectId);
      }
      return next;
    });
  }, []);

  const expandableProjectIds = projects
    .filter(project => (divergencesByProject.get(project.id) || []).length > 0)
    .map(project => project.id);

  const hasExpandableProjects = expandableProjectIds.length > 0;
  const isAllExpanded = hasExpandableProjects
    && expandableProjectIds.every(id => expandedProjects.has(id));

  const toggleAllProjects = useCallback(() => {
    hasUserToggledExpansion.current = true;
    setExpandedProjects(prev => {
      if (!hasExpandableProjects) {
        return prev;
      }
      const allExpanded = expandableProjectIds.every(id => prev.has(id));
      if (allExpanded) {
        return new Set();
      }
      return new Set(expandableProjectIds);
    });
  }, [expandableProjectIds, hasExpandableProjects]);

  const handleContextMenu = useCallback((
    e: React.MouseEvent,
    type: "project" | "divergence",
    item: Project | Divergence
  ) => {
    e.preventDefault();
    setContextMenu({
      type,
      id: item.id,
      x: e.clientX,
      y: e.clientY,
      item,
    });
  }, []);

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  const handleRemoveProject = useCallback(async () => {
    if (contextMenu?.type === "project") {
      await onRemoveProject(contextMenu.id);
    }
    closeContextMenu();
  }, [contextMenu, onRemoveProject, closeContextMenu]);

  const handleDeleteDivergence = useCallback(async () => {
    if (contextMenu?.type === "divergence") {
      const divergence = contextMenu.item as Divergence;
      const projectName = projects.find(project => project.id === divergence.project_id)?.name ?? "project";
      try {
        await invoke("delete_divergence", { path: divergence.path });
        const divergenceSessionName = buildTmuxSessionName({
          type: "divergence",
          projectName,
          projectId: divergence.project_id,
          divergenceId: divergence.id,
          branch: divergence.branch,
        });
        await invoke("kill_tmux_session", { sessionName: divergenceSessionName });
        await invoke("kill_tmux_session", {
          sessionName: buildSplitTmuxSessionName(divergenceSessionName, "pane-2"),
        });
        await invoke("kill_tmux_session", {
          sessionName: buildLegacyTmuxSessionName(`divergence-${divergence.id}`),
        });
        await onDeleteDivergence(divergence.id);
      } catch (err) {
        console.error("Failed to delete divergence:", err);
      }
    }
    closeContextMenu();
  }, [contextMenu, onDeleteDivergence, closeContextMenu, projects]);

  const getSessionStatus = useCallback((type: "project" | "divergence", id: number): TerminalSession["status"] | null => {
    const sessionId = `${type}-${id}`;
    return sessions.get(sessionId)?.status || null;
  }, [sessions]);

  const isActive = useCallback((type: "project" | "divergence", id: number): boolean => {
    const sessionId = `${type}-${id}`;
    return sessionId === activeSessionId;
  }, [activeSessionId]);

  return (
    <>
      <aside className="w-64 h-full bg-sidebar border-r border-surface flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-surface">
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
        </div>

        {/* Projects List */}
        <div className="flex-1 overflow-y-auto p-2" onClick={closeContextMenu}>
          <div className="flex items-center justify-between px-2 py-2">
            <div className="text-xs uppercase text-subtext font-medium">
              Projects
            </div>
            <button
              className="text-xs text-subtext hover:text-text disabled:opacity-50 disabled:cursor-default"
              onClick={toggleAllProjects}
              disabled={!hasExpandableProjects}
              title={isAllExpanded ? "Collapse all projects" : "Expand all projects"}
            >
              {isAllExpanded ? "Collapse all" : "Expand all"}
            </button>
          </div>

          {projects.length === 0 ? (
            <div className="px-2 py-8 text-center text-subtext text-sm">
              <p>No projects yet</p>
              <p className="text-xs mt-1">Click "Add Project" to get started</p>
            </div>
          ) : (
            <div className="space-y-1">
              {projects.map(project => {
                const divergences = divergencesByProject.get(project.id) || [];
                const isExpanded = expandedProjects.has(project.id);
                const projectStatus = getSessionStatus("project", project.id);
                const projectActive = isActive("project", project.id);

                return (
                  <div key={project.id}>
                    {/* Project Item */}
                    <div
                      className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer group ${
                        projectActive ? "bg-surface" : "hover:bg-surface/50"
                      }`}
                      onClick={() => onSelectProject(project)}
                      onContextMenu={(e) => handleContextMenu(e, "project", project)}
                    >
                      {/* Expand/Collapse */}
                      {divergences.length > 0 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleExpand(project.id);
                          }}
                          className="w-4 h-4 flex items-center justify-center text-subtext hover:text-text"
                        >
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
                        </button>
                      )}
                      {divergences.length === 0 && <div className="w-4" />}

                      {/* Status Indicator */}
                      <StatusIndicator status={projectStatus} />

                      {/* Name */}
                      <span className="flex-1 truncate text-sm text-text">
                        {project.name}
                      </span>

                      {/* Create Divergence Button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setCreateDivergenceFor(project);
                        }}
                        className="opacity-0 group-hover:opacity-100 w-5 h-5 flex items-center justify-center text-subtext hover:text-accent transition-opacity"
                        title="Create Divergence"
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
                            d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2"
                          />
                        </svg>
                      </button>
                    </div>

                    {/* Divergences */}
                    {isExpanded && divergences.length > 0 && (
                      <div className="ml-4 mt-1 space-y-1">
                        {divergences.map(divergence => {
                          const divStatus = getSessionStatus("divergence", divergence.id);
                          const divActive = isActive("divergence", divergence.id);

                          return (
                            <div
                              key={divergence.id}
                              className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer ${
                                divActive ? "bg-surface" : "hover:bg-surface/50"
                              }`}
                              onClick={() => onSelectDivergence(divergence)}
                              onContextMenu={(e) => handleContextMenu(e, "divergence", divergence)}
                            >
                              <div className="w-4" />
                              <StatusIndicator status={divStatus} />
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
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Add Project Button */}
        <div className="p-2 border-t border-surface">
          <button
            className="w-full px-3 py-2 bg-surface hover:bg-surface/80 text-text text-sm rounded-md flex items-center justify-center gap-2 transition-colors"
            onClick={handleAddProject}
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
          </button>
        </div>
      </aside>

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="fixed bg-surface border border-surface rounded-md shadow-lg py-1 z-50"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          {contextMenu.type === "project" && (
            <>
              <button
                className="w-full px-4 py-2 text-sm text-left text-text hover:bg-sidebar"
                onClick={() => {
                  setCreateDivergenceFor(contextMenu.item as Project);
                  closeContextMenu();
                }}
              >
                Create Divergence
              </button>
              <button
                className="w-full px-4 py-2 text-sm text-left text-red hover:bg-sidebar"
                onClick={handleRemoveProject}
              >
                Remove Project
              </button>
            </>
          )}
          {contextMenu.type === "divergence" && (
            <button
              className="w-full px-4 py-2 text-sm text-left text-red hover:bg-sidebar"
              onClick={handleDeleteDivergence}
            >
              Delete Divergence
            </button>
          )}
        </div>
      )}

      {/* Create Divergence Modal */}
      {createDivergenceFor && (
        <CreateDivergenceModal
          project={createDivergenceFor}
          onClose={() => setCreateDivergenceFor(null)}
          onCreated={(divergence) => {
            onDivergenceCreated();
            onSelectDivergence(divergence);
          }}
        />
      )}
    </>
  );
}

export default Sidebar;
