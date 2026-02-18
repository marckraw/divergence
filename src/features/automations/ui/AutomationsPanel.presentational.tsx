import {
  AutomationEditorModal,
  formatAutomationRunStatus,
  formatAutomationTimestamp,
  type Automation,
} from "../../../entities/automation";
import type { AutomationsPanelPresentationalProps } from "./AutomationsPanel.types";

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
            {" • "}
            {automation.keepSessionAlive ? "Interactive" : "Autonomous"}
          </div>
        </div>
        <div className="text-xs text-subtext">
          {formatAutomationRunStatus(runStatus)}
        </div>
      </div>

      <div className="mt-3 text-xs text-subtext space-y-1">
        <div>Last run: {formatAutomationTimestamp(automation.lastRunAtMs, "Never")}</div>
        <div>Next run: {formatAutomationTimestamp(automation.nextRunAtMs, "Not scheduled")}</div>
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
          description="Configure scheduled runs for this automation template."
          namePlaceholder="Daily repo audit"
          promptPlaceholder="Audit this repository for important regressions and propose fixes."
          enabledLabel="Enabled"
          cancelLabel={cancelEditVisible ? "Cancel edit" : "Cancel"}
          promptMinHeightClassName="min-h-[180px]"
          onFormChange={onFormChange}
          onSubmitForm={onSubmitForm}
          onCloseEditor={onCloseEditor}
        />
      )}
    </div>
  );
}

export default AutomationsPanelPresentational;
