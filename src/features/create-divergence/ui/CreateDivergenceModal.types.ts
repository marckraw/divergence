import type { KeyboardEvent } from "react";
import type { Project } from "../../../entities";

export interface CreateDivergenceModalProps {
  project: Project;
  onClose: () => void;
  onCreate: (branchName: string, useExistingBranch: boolean) => Promise<void>;
}

export interface CreateDivergenceModalPresentationalProps {
  project: Project;
  onClose: () => void;
  branchName: string;
  useExistingBranch: boolean;
  remoteBranches: string[];
  loadingBranches: boolean;
  isCreating: boolean;
  error: string | null;
  validationError: string | null;
  onBranchNameChange: (next: string) => void;
  onUseExistingBranchChange: (next: boolean) => void;
  onCreateClick: () => Promise<void>;
  onInputKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void;
}
