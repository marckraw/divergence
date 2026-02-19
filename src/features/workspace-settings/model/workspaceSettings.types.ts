export interface WorkspaceSettingsState {
  isEditingName: boolean;
  isEditingDescription: boolean;
  isSaving: boolean;
  error: string | null;
}
