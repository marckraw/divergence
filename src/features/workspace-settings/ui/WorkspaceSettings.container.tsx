import { useState, useCallback, useEffect, useMemo } from "react";
import type { Workspace, WorkspaceMember } from "../../../entities";
import {
  getWorkspace,
  listWorkspaceMembers,
  loadWorkspaceSettings,
} from "../../../entities/workspace";
import { getAdapterLabels } from "../../../entities/port-management";
import { updateWorkspaceFolder } from "../../workspace-management/api/workspaceFolder.api";
import { saveWorkspaceConfiguration, updateWorkspaceMembers } from "../service/workspaceSettings.service";
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
  const [defaultPort, setDefaultPort] = useState("");
  const [framework, setFramework] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const frameworkOptions = useMemo(() => getAdapterLabels(), []);

  useEffect(() => {
    let isDisposed = false;
    void (async () => {
      try {
        const [ws, m, settings] = await Promise.all([
          getWorkspace(workspaceId),
          listWorkspaceMembers(workspaceId),
          loadWorkspaceSettings(workspaceId),
        ]);
        if (isDisposed) {
          return;
        }

        if (ws) {
          setWorkspace(ws);
          setName(ws.name);
          setDescription(ws.description ?? "");
        } else {
          setWorkspace(null);
          setName("");
          setDescription("");
        }

        setMembers(m);
        setDefaultPort(settings.defaultPort ? String(settings.defaultPort) : "");
        setFramework(settings.framework ?? "");
      } catch (err) {
        if (isDisposed) {
          return;
        }
        setError(err instanceof Error ? err.message : "Failed to load workspace settings");
      }
    })();

    return () => {
      isDisposed = true;
    };
  }, [workspaceId]);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    setError(null);
    try {
      const parsedPort = Number.parseInt(defaultPort, 10);
      const validPort = Number.isInteger(parsedPort) && parsedPort >= 1 && parsedPort <= 65535
        ? parsedPort
        : null;

      await saveWorkspaceConfiguration({
        workspaceId,
        name,
        description: description || null,
        defaultPort: validPort,
        framework: framework || null,
      });
      await refreshWorkspaces();
      const ws = await getWorkspace(workspaceId);
      if (ws) setWorkspace(ws);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setIsSaving(false);
    }
  }, [workspaceId, name, description, defaultPort, framework, refreshWorkspaces]);

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
      defaultPort={defaultPort}
      framework={framework}
      frameworkOptions={frameworkOptions}
      isSaving={isSaving}
      error={error}
      onNameChange={setName}
      onDescriptionChange={setDescription}
      onDefaultPortChange={setDefaultPort}
      onFrameworkChange={setFramework}
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
