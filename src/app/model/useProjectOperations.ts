import { useCallback } from "react";
import { queueCreateDivergence } from "../../features/create-divergence";
import { executeDeleteDivergence } from "../../features/delete-divergence";
import { executeRemoveProject } from "../../features/remove-project";
import type { Divergence, Project, RunBackgroundTask } from "../../entities";

interface UseProjectOperationsParams {
  projectsById: Map<number, { name: string }>;
  divergencesByProject: Map<number, Divergence[]>;
  runTask: RunBackgroundTask;
  addProject: (name: string, path: string) => Promise<void>;
  removeProject: (id: number) => Promise<void>;
  refreshDivergences: () => Promise<void>;
  refreshPortAllocations: () => Promise<void>;
  closeSessionsForProject: (projectId: number) => void;
  closeSessionsForDivergence: (divergenceId: number) => void;
}

interface UseProjectOperationsResult {
  handleAddProject: (name: string, path: string) => Promise<void>;
  handleRemoveProject: (id: number) => Promise<void>;
  handleCreateDivergence: (
    project: Project,
    branchName: string,
    useExistingBranch: boolean
  ) => Promise<void>;
  handleDeleteDivergence: (
    divergence: Divergence,
    origin: string
  ) => Promise<void>;
}

export function useProjectOperations({
  projectsById,
  divergencesByProject,
  runTask,
  addProject,
  removeProject,
  refreshDivergences,
  refreshPortAllocations,
  closeSessionsForProject,
  closeSessionsForDivergence,
}: UseProjectOperationsParams): UseProjectOperationsResult {
  const handleAddProject = useCallback(
    async (name: string, path: string) => {
      await addProject(name, path);
    },
    [addProject]
  );

  const handleCreateDivergence = useCallback(
    async (
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
    },
    [refreshDivergences, refreshPortAllocations, runTask]
  );

  const handleDeleteDivergence = useCallback(
    async (divergence: Divergence, origin: string): Promise<void> => {
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
    },
    [
      closeSessionsForDivergence,
      projectsById,
      refreshDivergences,
      refreshPortAllocations,
      runTask,
    ]
  );

  const handleRemoveProject = useCallback(
    async (id: number): Promise<void> => {
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
    },
    [
      closeSessionsForProject,
      divergencesByProject,
      projectsById,
      refreshDivergences,
      removeProject,
      runTask,
    ]
  );

  return {
    handleAddProject,
    handleRemoveProject,
    handleCreateDivergence,
    handleDeleteDivergence,
  };
}
