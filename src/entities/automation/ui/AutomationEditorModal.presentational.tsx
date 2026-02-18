import type { AutomationEditorFormState } from "../model/automationEditor.types";

interface AutomationProjectOption {
  id: number;
  name: string;
}

interface AutomationEditorModalPresentationalProps {
  projects: AutomationProjectOption[];
  form: AutomationEditorFormState;
  formError: string | null;
  isSubmitting: boolean;
  submitLabel: string;
  description: string;
  namePlaceholder: string;
  promptPlaceholder: string;
  enabledLabel: string;
  cancelLabel: string;
  promptMinHeightClassName?: string;
  overlayClassName?: string;
  onFormChange: <K extends keyof AutomationEditorFormState>(
    key: K,
    value: AutomationEditorFormState[K]
  ) => void;
  onSubmitForm: () => Promise<void>;
  onCloseEditor: () => void;
}

function AutomationEditorModalPresentational({
  projects,
  form,
  formError,
  isSubmitting,
  submitLabel,
  description,
  namePlaceholder,
  promptPlaceholder,
  enabledLabel,
  cancelLabel,
  promptMinHeightClassName = "min-h-[160px]",
  overlayClassName = "fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4",
  onFormChange,
  onSubmitForm,
  onCloseEditor,
}: AutomationEditorModalPresentationalProps) {
  return (
    <div className={overlayClassName}>
      <div className="w-full max-w-2xl rounded-md border border-surface bg-sidebar max-h-[90vh] overflow-y-auto">
        <div className="px-4 py-3 border-b border-surface flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm text-text font-semibold">
              {form.id === null ? "New automation" : "Edit automation"}
            </h3>
            <p className="text-xs text-subtext mt-1">{description}</p>
          </div>
          <button
            type="button"
            onClick={onCloseEditor}
            className="w-7 h-7 rounded border border-surface text-subtext hover:text-text hover:bg-surface"
            disabled={isSubmitting}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="p-4 space-y-3">
          <div>
            <label className="block text-xs text-subtext mb-1">Name</label>
            <input
              type="text"
              value={form.name}
              onChange={(event) => onFormChange("name", event.target.value)}
              className="w-full px-3 py-2 text-sm bg-main border border-surface rounded text-text focus:outline-none focus:border-accent"
              placeholder={namePlaceholder}
            />
          </div>

          <div>
            <label className="block text-xs text-subtext mb-1">Project</label>
            <select
              value={form.projectId ?? ""}
              onChange={(event) => {
                const value = Number(event.target.value);
                onFormChange("projectId", Number.isFinite(value) ? value : null);
              }}
              className="w-full px-3 py-2 text-sm bg-main border border-surface rounded text-text focus:outline-none focus:border-accent"
            >
              <option value="">Select project</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-subtext mb-1">Agent</label>
              <select
                value={form.agent}
                onChange={(event) => onFormChange("agent", event.target.value as typeof form.agent)}
                className="w-full px-3 py-2 text-sm bg-main border border-surface rounded text-text focus:outline-none focus:border-accent"
              >
                <option value="claude">Claude</option>
                <option value="codex">Codex</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-subtext mb-1">Every (hours)</label>
              <input
                type="number"
                min={1}
                value={form.intervalHours}
                onChange={(event) => onFormChange("intervalHours", Number(event.target.value))}
                className="w-full px-3 py-2 text-sm bg-main border border-surface rounded text-text focus:outline-none focus:border-accent"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-subtext mb-1">Prompt</label>
            <textarea
              value={form.prompt}
              onChange={(event) => onFormChange("prompt", event.target.value)}
              className={`w-full ${promptMinHeightClassName} px-3 py-2 text-sm bg-main border border-surface rounded text-text focus:outline-none focus:border-accent`}
              placeholder={promptPlaceholder}
            />
          </div>

          <label className="inline-flex items-center gap-2 text-xs text-subtext">
            <input
              type="checkbox"
              checked={form.enabled}
              onChange={(event) => onFormChange("enabled", event.target.checked)}
              className="accent-accent"
            />
            {enabledLabel}
          </label>

          <div>
            <label className="inline-flex items-center gap-2 text-xs text-text">
              <input
                type="checkbox"
                checked={form.keepSessionAlive}
                onChange={(event) => onFormChange("keepSessionAlive", event.target.checked)}
                className="accent-accent"
              />
              Keep terminal session alive after completion
            </label>
            <div className="text-[11px] text-subtext ml-5 mt-1">
              When enabled, the tmux session won't be killed after the agent finishes, allowing
              you to attach and inspect the results.
            </div>
          </div>

          {formError && (
            <div className="px-3 py-2 rounded border border-red/30 bg-red/10 text-xs text-red">
              {formError}
            </div>
          )}
        </div>

        <div className="px-4 py-3 border-t border-surface flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onCloseEditor}
            className="px-3 py-2 text-xs rounded border border-surface text-text hover:bg-surface"
            disabled={isSubmitting}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={() => {
              void onSubmitForm();
            }}
            className="px-3 py-2 text-xs rounded bg-accent text-main hover:bg-accent/80 disabled:opacity-60"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Saving..." : submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default AutomationEditorModalPresentational;
