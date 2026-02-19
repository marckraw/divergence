import { useState, useCallback } from "react";
import type { CreateWorkspaceDivergenceModalContainerProps } from "./CreateWorkspaceDivergenceModal.types";
import CreateWorkspaceDivergenceModalPresentational from "./CreateWorkspaceDivergenceModal.presentational";

function CreateWorkspaceDivergenceModalContainer({
  workspace,
  memberProjects,
  onClose,
  onCreateDivergences,
}: CreateWorkspaceDivergenceModalContainerProps) {
  const [branchName, setBranchName] = useState("");
  const [useExistingBranch, setUseExistingBranch] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(async () => {
    if (!branchName.trim() || memberProjects.length === 0) return;

    setIsSubmitting(true);
    setError(null);

    try {
      await onCreateDivergences(workspace, memberProjects, branchName.trim(), useExistingBranch);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create divergences");
    } finally {
      setIsSubmitting(false);
    }
  }, [branchName, useExistingBranch, workspace, memberProjects, onCreateDivergences, onClose]);

  return (
    <CreateWorkspaceDivergenceModalPresentational
      workspace={workspace}
      memberProjects={memberProjects}
      branchName={branchName}
      useExistingBranch={useExistingBranch}
      isSubmitting={isSubmitting}
      error={error}
      onBranchNameChange={setBranchName}
      onUseExistingBranchChange={setUseExistingBranch}
      onSubmit={handleSubmit}
      onClose={onClose}
    />
  );
}

export default CreateWorkspaceDivergenceModalContainer;
