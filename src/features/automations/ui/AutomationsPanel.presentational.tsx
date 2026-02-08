import type { Automation } from "../../../entities/automation";
import type { AutomationsPanelPresentationalProps } from "./AutomationsPanel.types";

function formatNextRun(value: number | null): string {
  if (!value) {
    return "Not scheduled";
  }
  return new Date(value).toLocaleString();
}

function formatLastRun(value: number | null): string {
  if (!value) {
    return "Never";
  }
  return new Date(value).toLocaleString();
}

function formatRunStatus(status?: string): string {
  if (!status) {
    return "No runs yet";
  }
  if (status === "success") {
    return "Success";
  }
  if (status === "error") {
    return "Failed";
  }
  if (status === "running") {
    return "Running";
  }
  if (status === "queued") {
    return "Queued";
  }
  if (status === "skipped") {
    return "Skipped";
  }
  return status;
}

function AutomationCard({
  automation,
  onEdit,
  onDelete,
  onRunNow,
  runStatus,
}: {
  automation: Automation;
  onEdit: () => void;
  onDelete: () => Promise<void>;
  onRunNow: () => Promise<void>;
  runStatus?: string;
}) {
  return (
    <div className="rounded-md border border-surface bg-sidebar/50 p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm text-text font-semibold">{automation.name}</div>
          <div className="text-xs text-subtext mt-1">
            {automation.agent.toUpperCase()} • every {automation.intervalHours}h
          </div>
          <div className="text-xs text-subtext mt-1">
            {automation.enabled ? "Enabled" : "Disabled"}
          </div>
        </div>
        <div className="text-xs text-subtext">
          {formatRunStatus(runStatus)}
        </div>
      </div>

      <div className="mt-3 text-xs text-subtext space-y-1">
        <div>Last run: {formatLastRun(automation.lastRunAtMs)}</div>
        <div>Next run: {formatNextRun(automation.nextRunAtMs)}</div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            void onRunNow();
          }}
          className="px-2.5 py-1.5 text-xs rounded border border-surface text-text hover:bg-surface"
        >
          Run now
        </button>
        <button
          type="button"
          onClick={onEdit}
          className="px-2.5 py-1.5 text-xs rounded border border-surface text-text hover:bg-surface"
        >
          Edit
        </button>
        <button
          type="button"
          onClick={() => {
            void onDelete();
          }}
          className="px-2.5 py-1.5 text-xs rounded border border-red/30 text-red hover:bg-red/10"
        >
          Delete
        </button>
      </div>
    </div>
  );
}

function AutomationTemplateCard({
  onClick,
}: {
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left rounded-xl border border-surface bg-sidebar/50 p-4 hover:bg-surface/40 transition-colors"
    >
      <div className="text-sm font-semibold text-text">Run agent prompt on a schedule</div>
      <div className="mt-2 text-xs text-subtext">
        Configure prompt, agent, and interval. Runs while the app is open.
      </div>
    </button>
  );
}

function AutomationEditorModal({
  projects,
  form,
  formError,
  isSubmitting,
  submitLabel,
  cancelEditVisible,
  onFormChange,
  onSubmitForm,
  onCloseEditor,
}: Pick<
  AutomationsPanelPresentationalProps,
  | "projects"
  | "form"
  | "formError"
  | "isSubmitting"
  | "submitLabel"
  | "cancelEditVisible"
  | "onFormChange"
  | "onSubmitForm"
  | "onCloseEditor"
>) {
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl rounded-md border border-surface bg-sidebar max-h-[90vh] overflow-y-auto">
        <div className="px-4 py-3 border-b border-surface flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm text-text font-semibold">
              {form.id === null ? "New automation" : "Edit automation"}
            </h3>
            <p className="text-xs text-subtext mt-1">
              Configure scheduled runs for this automation template.
            </p>
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
              placeholder="Daily repo audit"
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
              className="w-full min-h-[180px] px-3 py-2 text-sm bg-main border border-surface rounded text-text focus:outline-none focus:border-accent"
              placeholder="Audit this repository for important regressions and propose fixes."
            />
          </div>

          <label className="inline-flex items-center gap-2 text-xs text-subtext">
            <input
              type="checkbox"
              checked={form.enabled}
              onChange={(event) => onFormChange("enabled", event.target.checked)}
              className="accent-accent"
            />
            Enabled
          </label>

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
            {cancelEditVisible ? "Cancel edit" : "Cancel"}
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

function AutomationsPanelPresentational({
  projects,
  automations,
  latestRunByAutomationId,
  loading,
  error,
  onRefresh,
  onDeleteAutomation,
  onRunAutomationNow,
  form,
  formError,
  isSubmitting,
  submitLabel,
  cancelEditVisible,
  isEditorOpen,
  onOpenCreateTemplate,
  onFormChange,
  onSubmitForm,
  onCloseEditor,
  onEditAutomation,
}: AutomationsPanelPresentationalProps) {
  return (
    <div className="h-full flex flex-col bg-main">
      <div className="px-5 py-4 border-b border-surface flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-text">Automations</h2>
          <p className="text-xs text-subtext">Run agent prompts on a schedule</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenCreateTemplate}
            className="px-3 py-1.5 text-xs rounded bg-accent text-main hover:bg-accent/80"
          >
            New automation
          </button>
          <button
            type="button"
            onClick={() => {
              void onRefresh();
            }}
            className="px-3 py-1.5 text-xs rounded border border-surface text-text hover:bg-surface"
            disabled={loading}
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-5">
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-subtext mb-2">
            Start with a template
          </h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
            <AutomationTemplateCard onClick={onOpenCreateTemplate} />
          </div>
        </section>

        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-subtext mb-2">
            Active automations
          </h3>
          {error && (
            <div className="mb-3 px-3 py-2 rounded border border-red/30 bg-red/10 text-xs text-red">
              {error}
            </div>
          )}

          {automations.length === 0 && !error && (
            <div className="px-3 py-8 rounded-md border border-surface bg-sidebar/50 text-center text-sm text-subtext">
              No automations yet.
            </div>
          )}

          <div className="space-y-3">
            {automations.map((automation) => (
              <AutomationCard
                key={automation.id}
                automation={automation}
                runStatus={latestRunByAutomationId.get(automation.id)?.status}
                onEdit={() => onEditAutomation(automation.id)}
                onDelete={() => onDeleteAutomation(automation.id)}
                onRunNow={() => onRunAutomationNow(automation.id)}
              />
            ))}
          </div>
        </section>
      </div>

      {isEditorOpen && (
        <AutomationEditorModal
          projects={projects}
          form={form}
          formError={formError}
          isSubmitting={isSubmitting}
          submitLabel={submitLabel}
          cancelEditVisible={cancelEditVisible}
          onFormChange={onFormChange}
          onSubmitForm={onSubmitForm}
          onCloseEditor={onCloseEditor}
        />
      )}
    </div>
  );
}

export default AutomationsPanelPresentational;
