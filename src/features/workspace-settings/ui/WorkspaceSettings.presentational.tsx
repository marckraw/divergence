import { Button, ErrorBanner, FormField, IconButton, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, TextInput, Textarea } from "../../../shared";
import type { WorkspaceSettingsPresentationalProps } from "./WorkspaceSettings.types";

function WorkspaceSettingsPresentational({
  workspace,
  members,
  projects,
  name,
  description,
  defaultPort,
  framework,
  frameworkOptions,
  isSaving,
  error,
  onNameChange,
  onDescriptionChange,
  onDefaultPortChange,
  onFrameworkChange,
  onSave,
  onAddMember,
  onRemoveMember,
  onRegenerateAgentFiles,
  onDelete,
  onClose,
}: WorkspaceSettingsPresentationalProps) {
  if (!workspace) {
    return (
      <div className="flex-1 flex items-center justify-center text-subtext">
        Workspace not found
      </div>
    );
  }

  const memberProjectIds = new Set(members.map((m) => m.projectId));
  const availableProjects = projects.filter((p) => !memberProjectIds.has(p.id));
  const memberProjects = projects.filter((p) => memberProjectIds.has(p.id));

  return (
    <div className="flex-1 h-full overflow-y-auto bg-main">
      <div className="max-w-2xl mx-auto p-6 space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-text">Workspace Settings</h1>
          <IconButton
            type="button"
            onClick={onClose}
            variant="subtle"
            size="sm"
            className="text-subtext hover:text-text transition-colors"
            label="Close"
            icon={(
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
          />
        </div>

        {error && <ErrorBanner>{error}</ErrorBanner>}

        {/* General Section */}
        <section className="space-y-4">
          <h2 className="text-sm font-medium text-subtext uppercase">General</h2>
          <FormField label="Name" htmlFor="workspace-settings-name">
            <TextInput
              id="workspace-settings-name"
              type="text"
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              tone="surface"
              className="text-sm focus:ring-1"
            />
          </FormField>
          <FormField label="Description" htmlFor="workspace-settings-description">
            <Textarea
              id="workspace-settings-description"
              value={description}
              onChange={(e) => onDescriptionChange(e.target.value)}
              rows={3}
              tone="surface"
              className="text-sm focus:ring-1 resize-none"
            />
          </FormField>
          <Button
            type="button"
            onClick={onSave}
            disabled={isSaving}
            variant="primary"
            size="md"
            className="px-4 py-2 bg-primary text-primary-foreground text-sm rounded hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
        </section>

        <section className="space-y-4">
          <h2 className="text-sm font-medium text-subtext uppercase">Port Management</h2>
          <p className="text-xs text-subtext">
            These defaults are used first when creating workspace divergences and their member divergences.
          </p>
          <FormField label="Framework" htmlFor="workspace-settings-framework">
            <Select value={framework || "__none__"} onValueChange={(val) => onFrameworkChange(val === "__none__" ? "" : val)}>
              <SelectTrigger id="workspace-settings-framework" tone="surface" className="text-sm">
                <SelectValue placeholder="Auto-detect" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Auto-detect</SelectItem>
                {frameworkOptions.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField label="Default Port" htmlFor="workspace-settings-default-port">
            <TextInput
              id="workspace-settings-default-port"
              type="number"
              min={1}
              max={65535}
              placeholder="Auto"
              value={defaultPort}
              onChange={(event) => onDefaultPortChange(event.target.value)}
              tone="surface"
              className="text-sm focus:ring-1"
            />
          </FormField>
        </section>

        {/* Member Projects Section */}
        <section className="space-y-4">
          <h2 className="text-sm font-medium text-subtext uppercase">Member Projects</h2>
          {memberProjects.length === 0 ? (
            <p className="text-sm text-subtext">No member projects</p>
          ) : (
            <div className="space-y-2">
              {memberProjects.map((project) => (
                <div
                  key={project.id}
                  className="flex items-center justify-between px-3 py-2 bg-surface rounded"
                >
                  <span className="text-sm text-text">{project.name}</span>
                  <Button
                    type="button"
                    onClick={() => onRemoveMember(project.id)}
                    variant="ghost"
                    size="xs"
                    className="text-xs text-red hover:text-red/80 transition-colors"
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          )}
          {availableProjects.length > 0 && (
            <div>
              <label className="block text-sm text-text mb-1">Add Project</label>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {availableProjects.map((project) => (
                  <Button
                    key={project.id}
                    type="button"
                    onClick={() => onAddMember(project.id)}
                    variant="ghost"
                    size="sm"
                    className="w-full text-left px-3 py-1.5 text-sm text-subtext hover:text-text hover:bg-surface/50 rounded transition-colors"
                  >
                    + {project.name}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Agent Files Section */}
        <section className="space-y-4">
          <h2 className="text-sm font-medium text-subtext uppercase">Agent Files</h2>
          <p className="text-xs text-subtext">
            CLAUDE.md and agents.md are auto-generated in the workspace folder.
          </p>
          <Button
            type="button"
            onClick={onRegenerateAgentFiles}
            variant="secondary"
            size="md"
            className="px-4 py-2 bg-surface text-text text-sm rounded hover:bg-surface/80 transition-colors"
          >
            Regenerate Agent Files
          </Button>
        </section>

        {/* Danger Zone */}
        <section className="space-y-4 border-t border-red/30 pt-6">
          <h2 className="text-sm font-medium text-red uppercase">Danger Zone</h2>
          <p className="text-xs text-subtext">
            Deleting a workspace removes its folder, symlinks, and agent files. Member projects are not affected.
          </p>
          <Button
            type="button"
            onClick={onDelete}
            variant="danger"
            size="md"
            className="px-4 py-2 bg-red/10 text-red text-sm rounded border border-red/30 hover:bg-red/20 transition-colors"
          >
            Delete Workspace
          </Button>
        </section>
      </div>
    </div>
  );
}

export default WorkspaceSettingsPresentational;
