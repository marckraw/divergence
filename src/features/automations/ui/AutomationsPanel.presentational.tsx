import type { Automation } from "../../../entities/automation";
import {
  Button,
  FormField,
  IconButton,
  ModalShell,
  Select,
  TextInput,
  Textarea,
} from "../../../shared";
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
            {automation.agent.toUpperCase()} - every {automation.intervalHours}h
          </div>
          <div className="text-xs text-subtext mt-1">
            {automation.enabled ? "Enabled" : "Disabled"}
            {" - "}
            {automation.keepSessionAlive ? "Interactive" : "Autonomous"}
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
        <Button
          onClick={() => {
            void onRunNow();
          }}
          size="sm"
          variant="secondary"
        >
          Run now
        </Button>
        <Button
          onClick={onEdit}
          size="sm"
          variant="secondary"
        >
          Edit
        </Button>
        <Button
          onClick={() => {
            void onDelete();
          }}
          size="sm"
          variant="danger"
        >
          Delete
        </Button>
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
    <Button
      onClick={onClick}
      variant="secondary"
      size="md"
      className="w-full justify-start rounded-xl text-left bg-sidebar/50 p-4 hover:bg-surface/40"
    >
      <span>
        <span className="block text-sm font-semibold text-text">Run agent prompt on a schedule</span>
        <span className="mt-2 block text-xs text-subtext">
          Configure prompt, agent, and interval. Runs while the app is open.
        </span>
      </span>
    </Button>
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
    <ModalShell
      onRequestClose={onCloseEditor}
      size="lg"
      surface="sidebar"
      overlayClassName="z-50 p-4"
      panelClassName="w-full max-w-2xl max-h-[90vh] overflow-y-auto"
    >
      <div className="px-4 py-3 border-b border-surface flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm text-text font-semibold">
            {form.id === null ? "New automation" : "Edit automation"}
          </h3>
          <p className="text-xs text-subtext mt-1">
            Configure scheduled runs for this automation template.
          </p>
        </div>
        <IconButton
          onClick={onCloseEditor}
          variant="subtle"
          size="sm"
          disabled={isSubmitting}
          label="Close"
          icon="x"
        />
      </div>

      <div className="p-4 space-y-3">
        <FormField label="Name" htmlFor="automation-form-name">
          <TextInput
            id="automation-form-name"
            value={form.name}
            onChange={(event) => onFormChange("name", event.target.value)}
            placeholder="Daily repo audit"
          />
        </FormField>

        <FormField label="Project" htmlFor="automation-form-project">
          <Select
            id="automation-form-project"
            value={form.projectId ?? ""}
            onChange={(event) => {
              const value = Number(event.target.value);
              onFormChange("projectId", Number.isFinite(value) ? value : null);
            }}
          >
            <option value="">Select project</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </Select>
        </FormField>

        <div className="grid grid-cols-2 gap-3">
          <FormField label="Agent" htmlFor="automation-form-agent" labelClassName="text-xs text-subtext">
            <Select
              id="automation-form-agent"
              value={form.agent}
              onChange={(event) => onFormChange("agent", event.target.value as typeof form.agent)}
            >
              <option value="claude">Claude</option>
              <option value="codex">Codex</option>
            </Select>
          </FormField>
          <FormField label="Every (hours)" htmlFor="automation-form-interval" labelClassName="text-xs text-subtext">
            <TextInput
              id="automation-form-interval"
              type="number"
              min={1}
              value={form.intervalHours}
              onChange={(event) => onFormChange("intervalHours", Number(event.target.value))}
            />
          </FormField>
        </div>

        <FormField label="Prompt" htmlFor="automation-form-prompt" labelClassName="text-xs text-subtext">
          <Textarea
            id="automation-form-prompt"
            value={form.prompt}
            onChange={(event) => onFormChange("prompt", event.target.value)}
            className="min-h-[180px]"
            placeholder="Audit this repository for important regressions and propose fixes."
          />
        </FormField>

        <label className="inline-flex items-center gap-2 text-xs text-subtext">
          <input
            type="checkbox"
            checked={form.enabled}
            onChange={(event) => onFormChange("enabled", event.target.checked)}
            className="accent-accent"
          />
          Enabled
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
            When enabled, the tmux session won&apos;t be killed after the agent finishes,
            allowing you to attach and inspect the results.
          </div>
        </div>

        {formError && (
          <div className="px-3 py-2 rounded border border-red/30 bg-red/10 text-xs text-red">
            {formError}
          </div>
        )}
      </div>

      <div className="px-4 py-3 border-t border-surface flex items-center justify-between gap-2">
        <Button
          onClick={onCloseEditor}
          variant="secondary"
          size="sm"
          disabled={isSubmitting}
        >
          {cancelEditVisible ? "Cancel edit" : "Cancel"}
        </Button>
        <Button
          onClick={() => {
            void onSubmitForm();
          }}
          variant="primary"
          size="sm"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Saving..." : submitLabel}
        </Button>
      </div>
    </ModalShell>
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
          <Button
            onClick={onOpenCreateTemplate}
            variant="primary"
            size="sm"
          >
            New automation
          </Button>
          <Button
            onClick={() => {
              void onRefresh();
            }}
            variant="secondary"
            size="sm"
            disabled={loading}
          >
            {loading ? "Refreshing..." : "Refresh"}
          </Button>
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
