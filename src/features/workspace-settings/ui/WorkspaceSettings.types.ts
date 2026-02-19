import type { Project, Workspace, WorkspaceMember } from "../../../entities";

export interface WorkspaceSettingsContainerProps {
  workspaceId: number;
  projects: Project[];
  onClose: () => void;
  onWorkspaceDeleted: () => void;
  onDeleteWorkspace: (workspace: Workspace) => Promise<void>;
  refreshWorkspaces: () => Promise<void>;
}

export interface WorkspaceSettingsPresentationalProps {
  workspace: Workspace | null;
  members: WorkspaceMember[];
  projects: Project[];
  name: string;
  description: string;
  isSaving: boolean;
  error: string | null;
  onNameChange: (name: string) => void;
  onDescriptionChange: (description: string) => void;
  onSave: () => void;
  onAddMember: (projectId: number) => void;
  onRemoveMember: (projectId: number) => void;
  onRegenerateAgentFiles: () => void;
  onDelete: () => void;
  onClose: () => void;
}
