import { loadProjectSettings } from "../../../lib/projectSettings";
import type { Divergence } from "../../../entities";
import { createDivergenceRepository, insertDivergenceRecord } from "../api/createDivergence.api";
import type { ExecuteCreateDivergenceParams } from "../model/createDivergence.types";

export async function executeCreateDivergence({
  project,
  branchName,
  useExistingBranch,
  runTask,
  refreshDivergences,
}: ExecuteCreateDivergenceParams): Promise<Divergence> {
  return runTask<Divergence>({
    kind: "create_divergence",
    title: `Create divergence: ${branchName}`,
    target: {
      type: "divergence",
      projectId: project.id,
      projectName: project.name,
      branch: branchName,
      path: project.path,
      label: `${project.name} / ${branchName}`,
    },
    origin: "create_divergence_modal",
    fsHeavy: true,
    initialPhase: "Queued",
    successMessage: `Created divergence: ${branchName}`,
    errorMessage: `Failed to create divergence: ${branchName}`,
    run: async ({ setPhase }) => {
      setPhase("Loading project settings");
      const settings = await loadProjectSettings(project.id);

      setPhase("Creating repository copy");
      const divergence = await createDivergenceRepository({
        project,
        branchName,
        copyIgnoredSkip: settings.copyIgnoredSkip,
        useExistingBranch,
      });

      setPhase("Saving divergence record");
      const insertedId = await insertDivergenceRecord(divergence);

      setPhase("Refreshing divergences");
      await refreshDivergences();
      return { ...divergence, id: insertedId };
    },
  });
}
