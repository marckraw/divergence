import type { Project, Workspace } from "../../../entities";

export interface CreateWorkspaceDivergenceModalContainerProps {
  workspace: Workspace;
  memberProjects: Project[];
  onClose: () => void;
  onCreateDivergences: (
    workspace: Workspace,
    memberProjects: Project[],
    branchName: string,
    useExistingBranch: boolean,
  ) => Promise<void>;
}

export interface CreateWorkspaceDivergenceModalPresentationalProps {
  workspace: Workspace;
  memberProjects: Project[];
  branchName: string;
  useExistingBranch: boolean;
  isSubmitting: boolean;
  error: string | null;
  onBranchNameChange: (name: string) => void;
  onUseExistingBranchChange: (value: boolean) => void;
  onSubmit: () => void;
  onClose: () => void;
}
