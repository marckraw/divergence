import {
  AutomationCard,
  formatRunStatus,
} from "../../../entities/automation";
import {
  Button,
  ErrorBanner,
  EmptyState,
  FormField,
  ModalFooter,
  ModalHeader,
  ModalShell,
  PanelHeader,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
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
      <ModalHeader
        title={form.id === null ? "New automation" : "Edit automation"}
        description="Configure scheduled or event-triggered automation runs."
        onClose={onCloseEditor}
        closeDisabled={isSubmitting}
      />

      <div className="p-4 space-y-3">
        <FormField label="Name" htmlFor="automation-form-name">
          <TextInput
            id="automation-form-name"
            value={form.name}
            onChange={(event) => onFormChange("name", event.target.value)}
            placeholder="Daily repo audit"
          />
        </FormField>

        <FormField label="Automation Type" htmlFor="automation-form-run-mode">
          <Select value={form.runMode} onValueChange={(val) => onFormChange("runMode", val as typeof form.runMode)}>
            <SelectTrigger id="automation-form-run-mode">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="schedule">Scheduled</SelectItem>
              <SelectItem value="event">GitHub PR merged</SelectItem>
            </SelectContent>
          </Select>
        </FormField>

        {form.runMode === "schedule" && (
          <FormField label="Project" htmlFor="automation-form-project">
            <Select
              value={form.projectId != null ? String(form.projectId) : "__none__"}
              onValueChange={(val) => {
                if (val === "__none__") {
                  onFormChange("projectId", null);
                } else {
                  const value = Number(val);
                  onFormChange("projectId", Number.isFinite(value) ? value : null);
                }
              }}
            >
              <SelectTrigger id="automation-form-project">
                <SelectValue placeholder="Select project" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Select project</SelectItem>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={String(project.id)}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        )}

        {form.runMode === "event" && (
          <>
            <FormField label="Source Project" htmlFor="automation-form-source-project">
              <Select
                value={form.sourceProjectId != null ? String(form.sourceProjectId) : "__none__"}
                onValueChange={(val) => {
                  if (val === "__none__") {
                    onFormChange("sourceProjectId", null);
                  } else {
                    const value = Number(val);
                    onFormChange("sourceProjectId", Number.isFinite(value) ? value : null);
                  }
                }}
              >
                <SelectTrigger id="automation-form-source-project">
                  <SelectValue placeholder="Select source project" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Select source project</SelectItem>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={String(project.id)}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>

            <FormField label="Target Project" htmlFor="automation-form-target-project">
              <Select
                value={form.targetProjectId != null ? String(form.targetProjectId) : "__none__"}
                onValueChange={(val) => {
                  if (val === "__none__") {
                    onFormChange("targetProjectId", null);
                  } else {
                    const value = Number(val);
                    onFormChange("targetProjectId", Number.isFinite(value) ? value : null);
                  }
                }}
              >
                <SelectTrigger id="automation-form-target-project">
                  <SelectValue placeholder="Select target project" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Select target project</SelectItem>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={String(project.id)}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>

            <FormField
              label="Base Branches (comma-separated)"
              htmlFor="automation-form-base-branches"
              labelClassName="text-xs text-subtext"
            >
              <TextInput
                id="automation-form-base-branches"
                value={form.baseBranches}
                onChange={(event) => onFormChange("baseBranches", event.target.value)}
                placeholder="stable, staging"
              />
            </FormField>
          </>
        )}

        <div className="grid grid-cols-2 gap-3">
          <FormField label="Agent" htmlFor="automation-form-agent" labelClassName="text-xs text-subtext">
            <Select value={form.agent} onValueChange={(val) => onFormChange("agent", val as typeof form.agent)}>
              <SelectTrigger id="automation-form-agent">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="claude">Claude</SelectItem>
                <SelectItem value="codex">Codex</SelectItem>
              </SelectContent>
            </Select>
          </FormField>
          {form.runMode === "schedule" ? (
            <FormField label="Every (hours)" htmlFor="automation-form-interval" labelClassName="text-xs text-subtext">
              <TextInput
                id="automation-form-interval"
                type="number"
                min={1}
                value={form.intervalHours}
                onChange={(event) => onFormChange("intervalHours", Number(event.target.value))}
              />
            </FormField>
          ) : (
            <div className="text-xs text-subtext border border-surface rounded-md px-3 py-2">
              Triggered by merged pull requests.
            </div>
          )}
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
            className="accent-primary"
          />
          Enabled
        </label>

        <div>
          <label className="inline-flex items-center gap-2 text-xs text-text">
            <input
              type="checkbox"
              checked={form.keepSessionAlive}
              onChange={(event) => onFormChange("keepSessionAlive", event.target.checked)}
              className="accent-primary"
            />
            Keep terminal session alive after completion
          </label>
          <div className="text-[11px] text-subtext ml-5 mt-1">
            When enabled, the tmux session won&apos;t be killed after the agent finishes,
            allowing you to attach and inspect the results.
          </div>
        </div>

        {formError && <ErrorBanner>{formError}</ErrorBanner>}
      </div>

      <ModalFooter className="justify-between">
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
      </ModalFooter>
    </ModalShell>
  );
}

function AutomationsPanelPresentational({
  projects,
  automations,
  latestRunByAutomationId,
  queuedCloudCountByAutomationId,
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
      <PanelHeader
        title="Automations"
        description="Run agent prompts on a schedule"
        actions={
          <>
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
          </>
        }
      />

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
          {error && <ErrorBanner className="mb-3">{error}</ErrorBanner>}

          {automations.length === 0 && !error && (
            <EmptyState bordered className="bg-sidebar/50">
              No automations yet.
            </EmptyState>
          )}

          <div className="space-y-3">
            {automations.map((automation) => {
              const queuedCloudCount = queuedCloudCountByAutomationId.get(automation.id) ?? 0;
              return (
                <AutomationCard
                key={automation.id}
                className="bg-sidebar/50"
                name={
                  <div className="text-sm text-text font-semibold">{automation.name}</div>
                }
                metadata={
                  <div className="text-xs text-subtext mt-1 space-y-1">
                    <div>
                      {automation.runMode === "event"
                        ? "Triggered: GitHub PR merged"
                        : `${automation.agent.toUpperCase()} - every ${automation.intervalHours}h`}
                    </div>
                    <div>
                      {automation.enabled ? "Enabled" : "Disabled"}
                      {" - "}
                      {automation.keepSessionAlive ? "Interactive" : "Autonomous"}
                    </div>
                    {automation.runMode === "event" && (
                      <div>
                        {`Source #${automation.sourceProjectId ?? "?"} -> Target #${automation.targetProjectId ?? "?"}`}
                      </div>
                    )}
                    {automation.runMode === "event" && (
                      <div>Queued cloud events: {queuedCloudCount}</div>
                    )}
                    <div>Last run: {formatLastRun(automation.lastRunAtMs)}</div>
                    <div>Next run: {formatNextRun(automation.nextRunAtMs)}</div>
                  </div>
                }
                status={formatRunStatus(latestRunByAutomationId.get(automation.id)?.status)}
                actions={
                  <>
                    <Button
                      onClick={() => {
                        void onRunAutomationNow(automation.id);
                      }}
                      size="sm"
                      variant="secondary"
                    >
                      Run now
                    </Button>
                    <Button
                      onClick={() => onEditAutomation(automation.id)}
                      size="sm"
                      variant="secondary"
                    >
                      Edit
                    </Button>
                    <Button
                      onClick={() => {
                        void onDeleteAutomation(automation.id);
                      }}
                      size="sm"
                      variant="danger"
                    >
                      Delete
                    </Button>
                  </>
                }
              />
              );
            })}
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
