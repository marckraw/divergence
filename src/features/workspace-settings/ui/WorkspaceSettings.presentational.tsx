import type { WorkspaceSettingsPresentationalProps } from "./WorkspaceSettings.types";

function WorkspaceSettingsPresentational({
  workspace,
  members,
  projects,
  name,
  description,
  isSaving,
  error,
  onNameChange,
  onDescriptionChange,
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
          <button
            type="button"
            onClick={onClose}
            className="text-subtext hover:text-text transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {error && (
          <div className="text-xs text-red bg-red/10 border border-red/30 rounded px-3 py-2">
            {error}
          </div>
        )}

        {/* General Section */}
        <section className="space-y-4">
          <h2 className="text-sm font-medium text-subtext uppercase">General</h2>
          <div>
            <label className="block text-sm text-text mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              className="w-full px-3 py-2 bg-surface border border-surface rounded text-sm text-text focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>
          <div>
            <label className="block text-sm text-text mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => onDescriptionChange(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 bg-surface border border-surface rounded text-sm text-text focus:outline-none focus:ring-1 focus:ring-accent resize-none"
            />
          </div>
          <button
            type="button"
            onClick={onSave}
            disabled={isSaving}
            className="px-4 py-2 bg-accent text-main text-sm rounded hover:bg-accent/90 disabled:opacity-50 transition-colors"
          >
            {isSaving ? "Saving..." : "Save Changes"}
          </button>
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
                  <button
                    type="button"
                    onClick={() => onRemoveMember(project.id)}
                    className="text-xs text-red hover:text-red/80 transition-colors"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
          {availableProjects.length > 0 && (
            <div>
              <label className="block text-sm text-text mb-1">Add Project</label>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {availableProjects.map((project) => (
                  <button
                    key={project.id}
                    type="button"
                    onClick={() => onAddMember(project.id)}
                    className="w-full text-left px-3 py-1.5 text-sm text-subtext hover:text-text hover:bg-surface/50 rounded transition-colors"
                  >
                    + {project.name}
                  </button>
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
          <button
            type="button"
            onClick={onRegenerateAgentFiles}
            className="px-4 py-2 bg-surface text-text text-sm rounded hover:bg-surface/80 transition-colors"
          >
            Regenerate Agent Files
          </button>
        </section>

        {/* Danger Zone */}
        <section className="space-y-4 border-t border-red/30 pt-6">
          <h2 className="text-sm font-medium text-red uppercase">Danger Zone</h2>
          <p className="text-xs text-subtext">
            Deleting a workspace removes its folder, symlinks, and agent files. Member projects are not affected.
          </p>
          <button
            type="button"
            onClick={onDelete}
            className="px-4 py-2 bg-red/10 text-red text-sm rounded border border-red/30 hover:bg-red/20 transition-colors"
          >
            Delete Workspace
          </button>
        </section>
      </div>
    </div>
  );
}

export default WorkspaceSettingsPresentational;
