import type { Project } from "../../../entities";

export interface CreateWorkspaceModalContainerProps {
  projects: Project[];
  onClose: () => void;
  onCreate: (name: string, description: string, selectedProjectIds: number[]) => Promise<void>;
}

export interface CreateWorkspaceModalPresentationalProps {
  name: string;
  description: string;
  selectedProjectIds: Set<number>;
  projects: Project[];
  isSubmitting: boolean;
  error: string | null;
  onNameChange: (name: string) => void;
  onDescriptionChange: (description: string) => void;
  onToggleProject: (projectId: number) => void;
  onSubmit: () => void;
  onClose: () => void;
}
