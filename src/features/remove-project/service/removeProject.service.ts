import {
  killDivergenceTmuxSessions,
  killProjectTmuxSessions,
} from "../../../shared/api/tmuxSessions.api";
import type { ExecuteRemoveProjectParams } from "../model/removeProject.types";

export async function executeRemoveProject({
  projectId,
  projectName,
  divergences,
  runTask,
  removeProject,
  closeSessionsForProject,
  refreshDivergences,
}: ExecuteRemoveProjectParams): Promise<void> {
  await runTask<void>({
    kind: "remove_project",
    title: `Remove project: ${projectName}`,
    target: {
      type: "project",
      projectId,
      projectName,
      label: projectName,
    },
    origin: "sidebar_context_menu",
    fsHeavy: false,
    initialPhase: "Queued",
    successMessage: `Removed project: ${projectName}`,
    errorMessage: `Failed to remove project: ${projectName}`,
    run: async ({ setPhase }) => {
      setPhase("Closing open tabs");
      closeSessionsForProject(projectId);

      setPhase("Removing project from database");
      await removeProject(projectId);

      setPhase("Closing terminal sessions");
      await killProjectTmuxSessions(projectId, projectName);
      for (const divergence of divergences) {
        await killDivergenceTmuxSessions(divergence, projectName);
      }

      setPhase("Refreshing divergences");
      await refreshDivergences();
    },
  });
}
