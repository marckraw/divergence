import { Button, CheckboxRow, ErrorBanner, FieldGroup, FormField, FormModalShell, TextInput } from "../../../shared";
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
    <FormModalShell
      onRequestClose={onClose}
      size="md"
      surface="main"
      panelClassName="w-full max-w-md mx-4"
      title="Create Workspace Divergences"
      description={`Create divergences for all projects in "${workspace.name}"`}
      body={(
        <div className="space-y-4">
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

        <CheckboxRow
          label="Use existing branch (if available)"
          checked={useExistingBranch}
          onChange={onUseExistingBranchChange}
        />

        <FieldGroup title={`Projects (${memberProjects.length})`}>
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
        </FieldGroup>

        {error && <ErrorBanner>{error}</ErrorBanner>}
        </div>
      )}
      footer={(
        <>
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
        </>
      )}
    />
  );
}

export default CreateWorkspaceDivergenceModalPresentational;
