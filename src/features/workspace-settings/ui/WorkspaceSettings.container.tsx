import { useState, useCallback, useEffect } from "react";
import type { Workspace, WorkspaceMember } from "../../../entities";
import { getWorkspace, listWorkspaceMembers } from "../../../entities/workspace";
import { updateWorkspaceFolder } from "../../workspace-management/api/workspaceFolder.api";
import { saveWorkspaceMetadata, updateWorkspaceMembers } from "../service/workspaceSettings.service";
import WorkspaceSettingsPresentational from "./WorkspaceSettings.presentational";
import type { WorkspaceSettingsContainerProps } from "./WorkspaceSettings.types";

function WorkspaceSettingsContainer({
  workspaceId,
  projects,
  onClose,
  onWorkspaceDeleted,
  onDeleteWorkspace,
  refreshWorkspaces,
}: WorkspaceSettingsContainerProps) {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const ws = await getWorkspace(workspaceId);
      if (ws) {
        setWorkspace(ws);
        setName(ws.name);
        setDescription(ws.description ?? "");
      }
      const m = await listWorkspaceMembers(workspaceId);
      setMembers(m);
    })();
  }, [workspaceId]);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    setError(null);
    try {
      await saveWorkspaceMetadata(workspaceId, name, description || null);
      await refreshWorkspaces();
      const ws = await getWorkspace(workspaceId);
      if (ws) setWorkspace(ws);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setIsSaving(false);
    }
  }, [workspaceId, name, description, refreshWorkspaces]);

  const handleAddMember = useCallback(async (projectId: number) => {
    setError(null);
    try {
      await updateWorkspaceMembers(workspaceId, [projectId], [], projects);
      const m = await listWorkspaceMembers(workspaceId);
      setMembers(m);
      await refreshWorkspaces();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add member");
    }
  }, [workspaceId, projects, refreshWorkspaces]);

  const handleRemoveMember = useCallback(async (projectId: number) => {
    setError(null);
    try {
      await updateWorkspaceMembers(workspaceId, [], [projectId], projects);
      const m = await listWorkspaceMembers(workspaceId);
      setMembers(m);
      await refreshWorkspaces();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove member");
    }
  }, [workspaceId, projects, refreshWorkspaces]);

  const handleRegenerateAgentFiles = useCallback(async () => {
    if (!workspace) return;
    setError(null);
    try {
      const memberProjectIds = new Set(members.map((m) => m.projectId));
      const memberProjects = projects.filter((p) => memberProjectIds.has(p.id));
      await updateWorkspaceFolder(
        workspace.folderPath,
        workspace.name,
        memberProjects.map((p) => ({ name: p.name, path: p.path })),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to regenerate agent files");
    }
  }, [workspace, members, projects]);

  const handleDelete = useCallback(async () => {
    if (!workspace) return;
    try {
      await onDeleteWorkspace(workspace);
      onWorkspaceDeleted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete workspace");
    }
  }, [workspace, onDeleteWorkspace, onWorkspaceDeleted]);

  return (
    <WorkspaceSettingsPresentational
      workspace={workspace}
      members={members}
      projects={projects}
      name={name}
      description={description}
      isSaving={isSaving}
      error={error}
      onNameChange={setName}
      onDescriptionChange={setDescription}
      onSave={handleSave}
      onAddMember={handleAddMember}
      onRemoveMember={handleRemoveMember}
      onRegenerateAgentFiles={handleRegenerateAgentFiles}
      onDelete={handleDelete}
      onClose={onClose}
    />
  );
}

export default WorkspaceSettingsContainer;
