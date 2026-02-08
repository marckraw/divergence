import { useMemo } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { Project, TerminalSession } from "../../../entities";
import { MenuButton, StatusIndicator } from "../../../shared/ui";
import CreateDivergenceModal from "../../../features/create-divergence";
import {
  FAST_EASE_OUT,
  SOFT_SPRING,
  getCollapseVariants,
  getPopVariants,
} from "../../../shared/lib/motion";
import {
  getSessionsForWorkspace,
  getSessionStatus,
  isSessionItemActive,
  isSessionActive,
} from "../lib/sidebar.pure";
import type { SidebarPresentationalProps } from "./Sidebar.types";

function SidebarPresentational({
  projects,
  divergencesByProject,
  sessions,
  activeSessionId,
  createDivergenceFor,
  onCreateDivergenceForChange,
  onSelectProject,
  onSelectDivergence,
  onSelectSession,
  onCreateDivergence,
  isCollapsed,
  expandedProjects,
  deletingDivergence,
  deleteError,
  contextMenu,
  hasExpandableProjects,
  isAllExpanded,
  onAddProjectClick,
  onToggleProjectExpand,
  onToggleAllProjects,
  onContextMenuOpen,
  onContextMenuClose,
  onContextMenuRemoveProject,
  onContextMenuDeleteDivergence,
  onContextMenuCloseSession,
  onContextMenuCloseSessionAndKillTmux,
}: SidebarPresentationalProps) {
  const shouldReduceMotion = useReducedMotion();
  const contextMenuVariants = useMemo(
    () => getPopVariants(shouldReduceMotion, 8, 0.98),
    [shouldReduceMotion]
  );
  const collapseVariants = useMemo(
    () => getCollapseVariants(shouldReduceMotion),
    [shouldReduceMotion]
  );
  const layoutTransition = shouldReduceMotion ? FAST_EASE_OUT : SOFT_SPRING;
  const contextSession = contextMenu?.type === "session"
    ? contextMenu.item as TerminalSession
    : null;

  return (
    <>
      <aside className={`w-full h-full bg-sidebar flex flex-col ${isCollapsed ? "" : "border-r border-surface"}`}>
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

        <div className="flex-1 overflow-y-auto p-2" onClick={onContextMenuClose}>
          {deletingDivergence && (
            <div className="px-2 py-2 mb-2 text-xs text-subtext border border-surface rounded-md bg-surface/30 flex items-center gap-2">
              <svg className="w-3 h-3 animate-spin text-accent" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                <path className="opacity-90" fill="currentColor" d="M22 12a10 10 0 00-10-10v4a6 6 0 016 6h4z" />
              </svg>
              <span>Deleting divergence: {deletingDivergence.branch}</span>
            </div>
          )}
          {deleteError && (
            <div className="px-2 py-2 mb-2 text-xs text-red border border-red/30 rounded-md bg-red/10">
              Failed to delete divergence: {deleteError}
            </div>
          )}
          <div className="flex items-center justify-between px-2 py-2">
            <div className="text-xs uppercase text-subtext font-medium">
              Projects
            </div>
            <button
              className="text-xs text-subtext hover:text-text disabled:opacity-50 disabled:cursor-default"
              onClick={onToggleAllProjects}
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
              {projects.map((project) => {
                const divergences = divergencesByProject.get(project.id) || [];
                const isExpanded = expandedProjects.has(project.id);
                const projectStatus = getSessionStatus(sessions, "project", project.id);
                const projectActive = isSessionActive(activeSessionId, sessions, "project", project.id);
                const projectSessions = getSessionsForWorkspace(sessions, "project", project.id);

                return (
                  <div key={project.id}>
                    <motion.div
                      className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer group ${
                        projectActive ? "bg-surface" : "hover:bg-surface/50"
                      } transition-colors`}
                      onClick={() => onSelectProject(project)}
                      onContextMenu={(event) => onContextMenuOpen(event, "project", project)}
                      layout={shouldReduceMotion ? undefined : "position"}
                      transition={layoutTransition}
                    >
                      {divergences.length > 0 && (
                        <button
                          onClick={(event) => {
                            event.stopPropagation();
                            onToggleProjectExpand(project.id);
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

                      <StatusIndicator status={projectStatus} />

                      <span className="flex-1 truncate text-sm text-text">
                        {project.name}
                      </span>

                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          onCreateDivergenceForChange(project);
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
                    </motion.div>

                    <AnimatePresence initial={false}>
                      {isExpanded && divergences.length > 0 && (
                        <motion.div
                          className="overflow-hidden"
                          variants={collapseVariants}
                          initial="hidden"
                          animate="visible"
                          exit="exit"
                          transition={layoutTransition}
                        >
                          <motion.div
                            className="ml-4 mt-1 space-y-1"
                            layout={shouldReduceMotion ? undefined : "position"}
                            transition={layoutTransition}
                          >
                            {divergences.map((divergence) => {
                              const divStatus = getSessionStatus(sessions, "divergence", divergence.id);
                              const divActive = isSessionActive(activeSessionId, sessions, "divergence", divergence.id);
                              const divergenceSessions = getSessionsForWorkspace(
                                sessions,
                                "divergence",
                                divergence.id
                              );

                              return (
                                <div key={divergence.id}>
                                  <motion.div
                                    className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer transition-colors ${
                                      divActive ? "bg-surface" : "hover:bg-surface/50"
                                    }`}
                                    onClick={() => onSelectDivergence(divergence)}
                                    onContextMenu={(event) => onContextMenuOpen(event, "divergence", divergence)}
                                    layout={shouldReduceMotion ? undefined : "position"}
                                    transition={layoutTransition}
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
                                  </motion.div>
                                  {divergenceSessions.length > 0 && (
                                    <div className="ml-8 mt-1 space-y-0.5">
                                      {divergenceSessions.map((session) => (
                                        <button
                                          key={session.id}
                                          type="button"
                                          className={`w-full text-left flex items-center gap-2 px-2 py-1 rounded text-xs transition-colors ${
                                            isSessionItemActive(activeSessionId, session.id)
                                              ? "bg-surface text-text"
                                              : "text-subtext hover:text-text hover:bg-surface/50"
                                          }`}
                                          onClick={() => onSelectSession(session.id)}
                                          onContextMenu={(event) => onContextMenuOpen(event, "session", session)}
                                        >
                                          <StatusIndicator status={session.status} />
                                          <span className="truncate">
                                            {session.sessionRole === "default" ? "default" : session.name}
                                          </span>
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </motion.div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                    {projectSessions.length > 0 && (
                      <div className="ml-8 mt-1 space-y-0.5">
                        {projectSessions.map((session) => (
                          <button
                            key={session.id}
                            type="button"
                            className={`w-full text-left flex items-center gap-2 px-2 py-1 rounded text-xs transition-colors ${
                              isSessionItemActive(activeSessionId, session.id)
                                ? "bg-surface text-text"
                                : "text-subtext hover:text-text hover:bg-surface/50"
                            }`}
                            onClick={() => onSelectSession(session.id)}
                            onContextMenu={(event) => onContextMenuOpen(event, "session", session)}
                          >
                            <StatusIndicator status={session.status} />
                            <span className="truncate">
                              {session.sessionRole === "default" ? "default" : session.name}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="p-2 border-t border-surface">
          <button
            className="w-full px-3 py-2 bg-surface hover:bg-surface/80 text-text text-sm rounded-md flex items-center justify-center gap-2 transition-colors"
            onClick={onAddProjectClick}
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

      <AnimatePresence>
        {contextMenu && (
          <motion.div
            className="fixed bg-surface border border-surface rounded-md shadow-lg py-1 z-50"
            style={{ left: contextMenu.x, top: contextMenu.y }}
            variants={contextMenuVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            transition={layoutTransition}
          >
            {contextMenu.type === "project" && (
              <>
                <MenuButton
                  onClick={() => {
                    onCreateDivergenceForChange(contextMenu.item as Project);
                    onContextMenuClose();
                  }}
                >
                  Create Divergence
                </MenuButton>
                <MenuButton
                  tone="danger"
                  onClick={onContextMenuRemoveProject}
                >
                  Remove Project
                </MenuButton>
              </>
            )}
            {contextMenu.type === "divergence" && (
              <MenuButton
                tone="danger"
                onClick={onContextMenuDeleteDivergence}
                disabled={Boolean(deletingDivergence)}
              >
                {deletingDivergence?.id === contextMenu.id ? "Deleting..." : "Delete Divergence"}
              </MenuButton>
            )}
            {contextMenu.type === "session" && (
              <>
                <MenuButton
                  tone="danger"
                  onClick={onContextMenuCloseSession}
                >
                  Close Session
                </MenuButton>
                {contextSession?.useTmux && (
                  <MenuButton
                    tone="danger"
                    onClick={() => {
                      void onContextMenuCloseSessionAndKillTmux();
                    }}
                  >
                    Close Session + Kill Tmux
                  </MenuButton>
                )}
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {createDivergenceFor && (
          <CreateDivergenceModal
            project={createDivergenceFor}
            onClose={() => onCreateDivergenceForChange(null)}
            onCreate={(branchName, useExistingBranch) =>
              onCreateDivergence(createDivergenceFor, branchName, useExistingBranch)
            }
            onCreated={(divergence) => {
              onSelectDivergence(divergence);
            }}
          />
        )}
      </AnimatePresence>
    </>
  );
}

export default SidebarPresentational;
