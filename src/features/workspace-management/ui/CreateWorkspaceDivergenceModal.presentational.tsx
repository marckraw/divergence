import { Button, ErrorBanner, FormField, ModalFooter, ModalShell, TextInput } from "../../../shared";
import type { CreateWorkspaceDivergenceModalPresentationalProps } from "./CreateWorkspaceDivergenceModal.types";

function CreateWorkspaceDivergenceModalPresentational({
  workspace,
  memberProjects,
  branchName,
  useExistingBranch,
  isSubmitting,
  error,
  onBranchNameChange,
  onUseExistingBranchChange,
  onSubmit,
  onClose,
}: CreateWorkspaceDivergenceModalPresentationalProps) {
  const canSubmit = branchName.trim().length > 0 && memberProjects.length > 0 && !isSubmitting;

  return (
    <ModalShell
      onRequestClose={onClose}
      size="md"
      surface="main"
      panelClassName="w-full max-w-md mx-4"
    >
      <div className="p-4 border-b border-surface">
        <h2 className="text-lg font-semibold text-text">Create Workspace Divergences</h2>
        <p className="text-xs text-subtext mt-1">
          Create divergences for all projects in &quot;{workspace.name}&quot;
        </p>
      </div>

      <div className="p-4 space-y-4">
        <FormField label="Branch Name" htmlFor="create-workspace-divergence-branch">
          <TextInput
            id="create-workspace-divergence-branch"
            value={branchName}
            onChange={(e) => onBranchNameChange(e.target.value)}
            placeholder="feat/my-feature"
            tone="surface"
            autoFocus
          />
        </FormField>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={useExistingBranch}
            onChange={(e) => onUseExistingBranchChange(e.target.checked)}
            className="rounded border-surface text-accent focus:ring-accent"
          />
          <span className="text-sm text-text">Use existing branch (if available)</span>
        </label>

        <div>
          <label className="block text-sm text-text mb-1">
            Projects ({memberProjects.length})
          </label>
          <div className="max-h-32 overflow-y-auto border border-surface rounded">
            {memberProjects.map((project) => (
              <div
                key={project.id}
                className="px-3 py-1.5 text-sm text-subtext border-b border-surface last:border-b-0"
              >
                {project.name}
              </div>
            ))}
          </div>
        </div>

        {error && <ErrorBanner>{error}</ErrorBanner>}
      </div>

      <ModalFooter className="p-4">
        <Button
          onClick={onClose}
          variant="ghost"
          size="md"
        >
          Cancel
        </Button>
        <Button
          onClick={onSubmit}
          disabled={!canSubmit}
          variant="primary"
          size="md"
        >
          {isSubmitting ? "Creating..." : `Create ${memberProjects.length} Divergences`}
        </Button>
      </ModalFooter>
    </ModalShell>
  );
}

export default CreateWorkspaceDivergenceModalPresentational;
