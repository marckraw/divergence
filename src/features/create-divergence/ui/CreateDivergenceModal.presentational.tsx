import { Button, ModalShell, TextInput } from "../../../shared";
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
    <ModalShell
      onRequestClose={onClose}
      size="sm"
      surface="sidebar"
      panelClassName="w-96 p-4"
    >
      <h2 className="text-lg font-semibold text-text mb-4">Create Divergence</h2>

      <div className="mb-4">
        <label className="block text-sm text-subtext mb-1">Project</label>
        <div className="text-text">{project.name}</div>
        <div className="text-xs text-subtext truncate">{project.path}</div>
      </div>

      <div className="mb-4">
        <label className="block text-sm text-subtext mb-1">Branch Name</label>
        <TextInput
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
      </div>

      <div className="mb-4 flex items-start gap-3">
        <input
          type="checkbox"
          checked={useExistingBranch}
          onChange={(event) => onUseExistingBranchChange(event.target.checked)}
          className="mt-1 accent-accent"
          disabled={isCreating}
        />
        <div>
          <p className="text-sm text-text">Use existing branch from origin</p>
          <p className="text-xs text-subtext">
            When enabled, Divergence checks out the remote branch instead of creating a new one.
          </p>
          {useExistingBranch && loadingBranches && (
            <p className="text-xs text-subtext mt-1">Loading remote branches...</p>
          )}
        </div>
      </div>

      {isCreating && (
        <div className="mb-4">
          <div className="text-xs text-subtext mb-2">Creating divergence...</div>
          <div className="h-2 bg-surface rounded-full overflow-hidden">
            <div className="h-full w-1/3 bg-accent progress-indeterminate" />
          </div>
        </div>
      )}

      {error && (
        <div className="mb-4 px-3 py-2 bg-red/10 border border-red/30 rounded text-red text-sm">
          {error}
        </div>
      )}

      <div className="flex justify-end gap-2">
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
      </div>
    </ModalShell>
  );
}

export default CreateDivergenceModalPresentational;
