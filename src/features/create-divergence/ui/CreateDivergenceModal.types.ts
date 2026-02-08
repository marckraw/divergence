import type { KeyboardEvent, MouseEvent } from "react";
import type { Divergence, Project } from "../../../entities";

export interface CreateDivergenceModalProps {
  project: Project;
  onClose: () => void;
  onCreate: (branchName: string, useExistingBranch: boolean) => Promise<Divergence>;
  onCreated: (divergence: Divergence) => void;
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
  onOverlayClick: () => void;
  onPanelClick: (event: MouseEvent<HTMLDivElement>) => void;
}
