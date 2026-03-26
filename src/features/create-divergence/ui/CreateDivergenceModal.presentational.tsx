import { Button, CheckboxRow, ErrorBanner, FieldGroup, FormField, FormModalShell, TextInput } from "../../../shared";
import type { CreateDivergenceModalPresentationalProps } from "./CreateDivergenceModal.types";

function CreateDivergenceModalPresentational({
  project,
  onClose,
  branchName,
  useExistingBranch,
  remoteBranches,
  loadingBranches,
  isCreating,
  error,
  validationError,
  onBranchNameChange,
  onUseExistingBranchChange,
  onCreateClick,
  onInputKeyDown,
}: CreateDivergenceModalPresentationalProps) {
  return (
    <FormModalShell
      onRequestClose={onClose}
      size="sm"
      surface="sidebar"
      panelClassName="w-96"
      title="Create Divergence"
      body={(
        <div className="space-y-4">
          <FieldGroup title="Project">
            <div className="text-text">{project.name}</div>
            <div className="text-xs text-subtext truncate">{project.path}</div>
          </FieldGroup>

          <FormField label="Branch Name" htmlFor="create-divergence-branch-name">
            <TextInput
              id="create-divergence-branch-name"
              type="text"
              value={branchName}
              onChange={(event) => onBranchNameChange(event.target.value)}
              onKeyDown={onInputKeyDown}
              placeholder="feature/my-feature"
              list={useExistingBranch ? "remote-branches" : undefined}
              autoFocus
              disabled={isCreating}
            />
            {useExistingBranch && (
              <datalist id="remote-branches">
                {remoteBranches.map((branch) => (
                  <option value={branch} key={branch} />
                ))}
              </datalist>
            )}
          </FormField>

          <CheckboxRow
            label="Use existing branch from origin"
            description={useExistingBranch && loadingBranches
              ? "Loading remote branches..."
              : "When enabled, Divergence checks out the remote branch instead of creating a new one."}
            checked={useExistingBranch}
            onChange={onUseExistingBranchChange}
            disabled={isCreating}
          />

          {isCreating && (
            <div>
              <div className="text-xs text-subtext mb-2">Creating divergence...</div>
              <div className="h-2 bg-surface rounded-full overflow-hidden">
                <div className="h-full w-1/3 bg-accent progress-indeterminate" />
              </div>
            </div>
          )}

          {error && (
            <ErrorBanner className="text-sm">{error}</ErrorBanner>
          )}
        </div>
      )}
      footer={(
        <>
          <Button
            onClick={onClose}
            variant="ghost"
            size="md"
            disabled={isCreating}
          >
            Cancel
          </Button>
          <Button
            onClick={() => {
              void onCreateClick();
            }}
            disabled={isCreating || Boolean(validationError)}
            variant="primary"
            size="md"
          >
            {isCreating ? "Creating..." : "Create"}
          </Button>
        </>
      )}
    />
  );
}

export default CreateDivergenceModalPresentational;
