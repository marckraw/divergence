import { useCallback, useState } from "react";
import type { KeyboardEvent } from "react";
import {
  normalizeBranchName,
  validateBranchName,
} from "../lib/createDivergence.pure";
import { listRemoteBranches } from "../api/createDivergence.api";
import CreateDivergenceModalPresentational from "./CreateDivergenceModal.presentational";
import type { CreateDivergenceModalProps } from "./CreateDivergenceModal.types";

function CreateDivergenceModalContainer({
  project,
  onClose,
  onCreate,
  onCreated,
}: CreateDivergenceModalProps) {
  const [branchName, setBranchName] = useState("");
  const [useExistingBranch, setUseExistingBranch] = useState(false);
  const [remoteBranches, setRemoteBranches] = useState<string[]>([]);
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadRemoteBranches = useCallback(async () => {
    if (loadingBranches) {
      return;
    }

    setLoadingBranches(true);
    try {
      const branches = await listRemoteBranches(project.path);
      setRemoteBranches(branches);
    } catch (err) {
      console.warn("Failed to load remote branches:", err);
    } finally {
      setLoadingBranches(false);
    }
  }, [loadingBranches, project.path]);

  const handleCreate = useCallback(async () => {
    const normalizedBranchName = normalizeBranchName(branchName);
    const validationError = validateBranchName(normalizedBranchName);
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      const divergence = await onCreate(normalizedBranchName, useExistingBranch);
      onCreated(divergence);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsCreating(false);
    }
  }, [branchName, onClose, onCreate, onCreated, useExistingBranch]);

  const handleUseExistingBranchChange = useCallback((next: boolean) => {
    setUseExistingBranch(next);
    if (next && remoteBranches.length === 0) {
      void loadRemoteBranches();
    }
  }, [loadRemoteBranches, remoteBranches.length]);

  const handleInputKeyDown = useCallback((event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" && !isCreating) {
      void handleCreate();
      return;
    }

    if (event.key === "Escape") {
      onClose();
    }
  }, [handleCreate, isCreating, onClose]);

  return (
    <CreateDivergenceModalPresentational
      project={project}
      onClose={onClose}
      branchName={branchName}
      useExistingBranch={useExistingBranch}
      remoteBranches={remoteBranches}
      loadingBranches={loadingBranches}
      isCreating={isCreating}
      error={error}
      validationError={validateBranchName(branchName)}
      onBranchNameChange={setBranchName}
      onUseExistingBranchChange={handleUseExistingBranchChange}
      onCreateClick={handleCreate}
      onInputKeyDown={handleInputKeyDown}
      onOverlayClick={onClose}
      onPanelClick={(event) => {
        event.stopPropagation();
      }}
    />
  );
}

export default CreateDivergenceModalContainer;
