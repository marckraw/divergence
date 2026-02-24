import {
  AutomationCard,
  formatRunStatus,
} from "../../../entities/automation";
import {
  Button,
  EDITOR_THEME_OPTIONS_DARK,
  EDITOR_THEME_OPTIONS_LIGHT,
  EmptyState,
  ErrorBanner,
  FormField,
  IconButton,
  Kbd,
  ModalFooter,
  ModalHeader,
  ModalShell,
  ProgressBar,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  TextInput,
  Textarea,
  type EditorThemeId,
} from "../../../shared";
import type { SettingsPresentationalProps } from "./Settings.types";

function formatDateTime(value: number | null | undefined): string {
  if (!value) {
    return "Never";
  }
  return new Date(value).toLocaleString();
}

function AutomationEditorModal({
  projects,
  automationForm,
  automationFormError,
  isSubmittingAutomation,
  automationSubmitLabel,
  onAutomationFormChange,
  onSubmitAutomationForm,
  onCloseAutomationEditor,
}: Pick<
  SettingsPresentationalProps,
  | "projects"
  | "automationForm"
  | "automationFormError"
  | "isSubmittingAutomation"
  | "automationSubmitLabel"
  | "onAutomationFormChange"
  | "onSubmitAutomationForm"
  | "onCloseAutomationEditor"
>) {
  return (
    <ModalShell
      onRequestClose={onCloseAutomationEditor}
      size="lg"
      surface="sidebar"
      overlayClassName="z-[60] p-4"
      panelClassName="w-full max-w-2xl max-h-[90vh] overflow-y-auto"
    >
        <ModalHeader
          title={automationForm.id === null ? "New automation" : "Edit automation"}
          description="Manual-only mode. Scheduled execution is disabled while we rebuild this feature."
          onClose={onCloseAutomationEditor}
          closeDisabled={isSubmittingAutomation}
        />

        <div className="p-4 space-y-3">
          <FormField label="Name" htmlFor="settings-automation-name" labelClassName="block text-xs text-subtext mb-1">
            <TextInput
              id="settings-automation-name"
              type="text"
              value={automationForm.name}
              onChange={(event) => onAutomationFormChange("name", event.target.value)}
              className="text-sm focus:ring-0"
              placeholder="Manual repo audit"
            />
          </FormField>

          <FormField label="Project" htmlFor="settings-automation-project" labelClassName="block text-xs text-subtext mb-1">
            <Select
              value={automationForm.projectId != null ? String(automationForm.projectId) : "__none__"}
              onValueChange={(val) => {
                if (val === "__none__") {
                  onAutomationFormChange("projectId", null);
                } else {
                  const value = Number(val);
                  onAutomationFormChange("projectId", Number.isFinite(value) ? value : null);
                }
              }}
            >
              <SelectTrigger id="settings-automation-project" className="text-sm">
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

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Agent" htmlFor="settings-automation-agent" labelClassName="block text-xs text-subtext mb-1">
              <Select value={automationForm.agent} onValueChange={(val) => onAutomationFormChange("agent", val as typeof automationForm.agent)}>
                <SelectTrigger id="settings-automation-agent" className="text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="claude">Claude</SelectItem>
                  <SelectItem value="codex">Codex</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="Every (hours)" htmlFor="settings-automation-interval" labelClassName="block text-xs text-subtext mb-1">
              <TextInput
                id="settings-automation-interval"
                type="number"
                min={1}
                value={automationForm.intervalHours}
                onChange={(event) => onAutomationFormChange("intervalHours", Number(event.target.value))}
                className="text-sm focus:ring-0"
              />
            </FormField>
          </div>

          <FormField label="Prompt" htmlFor="settings-automation-prompt" labelClassName="block text-xs text-subtext mb-1">
            <Textarea
              id="settings-automation-prompt"
              value={automationForm.prompt}
              onChange={(event) => onAutomationFormChange("prompt", event.target.value)}
              className="min-h-[160px] text-sm focus:ring-0"
              placeholder="Audit this repository and summarize high-impact regressions."
            />
          </FormField>

          <label className="inline-flex items-center gap-2 text-xs text-subtext">
            <input
              type="checkbox"
              checked={automationForm.enabled}
              onChange={(event) => onAutomationFormChange("enabled", event.target.checked)}
              className="accent-primary"
            />
            Enabled (stored only for future scheduler phases)
          </label>

          <div>
            <label className="inline-flex items-center gap-2 text-xs text-text">
              <input
                type="checkbox"
                checked={automationForm.keepSessionAlive}
                onChange={(event) => onAutomationFormChange("keepSessionAlive", event.target.checked)}
                className="accent-primary"
              />
              Keep terminal session alive after completion
            </label>
            <div className="text-[11px] text-subtext ml-5 mt-1">
              When enabled, the tmux session won't be killed after the agent finishes,
              allowing you to attach and inspect the results.
            </div>
          </div>

          {automationFormError && <ErrorBanner>{automationFormError}</ErrorBanner>}
        </div>

        <ModalFooter className="justify-between">
          <Button
            onClick={onCloseAutomationEditor}
            variant="secondary"
            size="sm"
            disabled={isSubmittingAutomation}
          >
            Cancel
          </Button>
          <Button
            onClick={() => {
              void onSubmitAutomationForm();
            }}
            variant="primary"
            size="sm"
            disabled={isSubmittingAutomation}
          >
            {isSubmittingAutomation ? "Saving..." : automationSubmitLabel}
          </Button>
        </ModalFooter>
    </ModalShell>
  );
}

function SettingsPresentational({
  loading,
  settings,
  appVersion,
  updater,
  updaterPresentation,
  projects,
  automations,
  latestRunByAutomationId,
  automationsLoading,
  automationsError,
  automationActionError,
  automationActionInFlightId,
  isEditorOpen,
  automationForm,
  automationFormError,
  isSubmittingAutomation,
  automationSubmitLabel,
  onClose,
  onSave,
  onUpdateSetting,
  onRefreshAutomations,
  onOpenCreateAutomation,
  onEditAutomation,
  onDeleteAutomation,
  onRunAutomationNow,
  onAutomationFormChange,
  onSubmitAutomationForm,
  onCloseAutomationEditor,
  oauthTokenVisible,
  onToggleOAuthTokenVisible,
}: SettingsPresentationalProps) {
  if (loading) {
    return (
      <ModalShell
        closeOnOverlayClick={false}
        size="sm"
        surface="sidebar"
        panelClassName="p-8"
      >
        <p className="text-subtext">Loading settings...</p>
      </ModalShell>
    );
  }

  return (
    <ModalShell
      onRequestClose={onClose}
      size="xl"
      surface="sidebar"
      panelClassName="w-[640px] max-h-[85vh] overflow-y-auto"
    >
        <div className="p-4 border-b border-surface flex items-center justify-between">
          <h2 className="text-lg font-semibold text-text">Settings</h2>
          <IconButton
            onClick={onClose}
            variant="subtle"
            size="sm"
            label="Close"
            icon={(
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            )}
          />
        </div>

        <div className="p-4 space-y-6">
          <div>
            <label className="block text-sm font-medium text-text mb-2">
              Default Shell
            </label>
            <Select value={settings.defaultShell} onValueChange={(val) => onUpdateSetting("defaultShell", val)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="/bin/zsh">zsh</SelectItem>
                <SelectItem value="/bin/bash">bash</SelectItem>
                <SelectItem value="/bin/sh">sh</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-subtext mt-1">
              Shell used for new terminal sessions
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-text mb-2">
              Theme
            </label>
            <div className="flex gap-2">
              <Button
                onClick={() => onUpdateSetting("theme", "dark")}
                variant={settings.theme === "dark" ? "primary" : "subtle"}
                size="md"
                className={`flex-1 px-4 py-2 rounded border ${
                  settings.theme === "dark"
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-surface text-subtext hover:text-text"
                }`}
              >
                Dark
              </Button>
              <Button
                onClick={() => onUpdateSetting("theme", "light")}
                variant={settings.theme === "light" ? "primary" : "subtle"}
                size="md"
                className={`flex-1 px-4 py-2 rounded border ${
                  settings.theme === "light"
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-surface text-subtext hover:text-text"
                }`}
              >
                Light
              </Button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-text mb-2">
              Editor Theme (When App is Light)
            </label>
            <Select value={settings.editorThemeForLightMode} onValueChange={(val) => onUpdateSetting("editorThemeForLightMode", val as EditorThemeId)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EDITOR_THEME_OPTIONS_LIGHT.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-subtext mt-1">
              Editor theme used when the app is in light mode.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-text mb-2">
              Editor Theme (When App is Dark)
            </label>
            <Select value={settings.editorThemeForDarkMode} onValueChange={(val) => onUpdateSetting("editorThemeForDarkMode", val as EditorThemeId)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EDITOR_THEME_OPTIONS_DARK.map((option) => (
                  <SelectItem key={option.id} value={String(option.id)}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-subtext mt-1">
              Editor theme used when the app is in dark mode.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-text mb-2">
              Divergence Storage
            </label>
            <div className="px-3 py-2 bg-main border border-surface rounded text-subtext text-sm">
              {settings.divergenceBasePath}
            </div>
            <p className="text-xs text-subtext mt-1">
              Cloned repositories are stored in this location
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-text mb-2">
              tmux History Limit
            </label>
            <TextInput
              type="number"
              min={1000}
              max={500000}
              value={settings.tmuxHistoryLimit}
              onChange={(event) => onUpdateSetting("tmuxHistoryLimit", Number(event.target.value))}
              className="focus:ring-0"
            />
            <p className="text-xs text-subtext mt-1">
              Lines kept in tmux scrollback. Recommended: 50,000.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-text mb-2">
              Terminal Tabs
            </label>
            <label className="inline-flex items-center gap-2 text-sm text-text">
              <input
                type="checkbox"
                checked={settings.restoreTabsOnRestart}
                onChange={(event) => onUpdateSetting("restoreTabsOnRestart", event.target.checked)}
                className="accent-primary"
              />
              Restore open terminal tabs on restart
            </label>
            <p className="text-xs text-subtext mt-1">
              Reopens your currently open tabs when Divergence launches again.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-text mb-2">
              Claude Command Template
            </label>
            <TextInput
              type="text"
              value={settings.agentCommandClaude}
              onChange={(event) => onUpdateSetting("agentCommandClaude", event.target.value)}
              className="focus:ring-0"
            />
            <p className="text-xs text-subtext mt-1">
              Supports <code>{"{workspacePath}"}</code> and <code>{"{briefPath}"}</code>.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-text mb-2">
              Codex Command Template
            </label>
            <TextInput
              type="text"
              value={settings.agentCommandCodex}
              onChange={(event) => onUpdateSetting("agentCommandCodex", event.target.value)}
              className="focus:ring-0"
            />
            <p className="text-xs text-subtext mt-1">
              Supports <code>{"{workspacePath}"}</code> and <code>{"{briefPath}"}</code>.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-text mb-2">
              Claude OAuth Token (Automations)
            </label>
            <div className="relative">
              <TextInput
                type={oauthTokenVisible ? "text" : "password"}
                value={settings.claudeOAuthToken}
                onChange={(event) => onUpdateSetting("claudeOAuthToken", event.target.value)}
                className="pr-10 focus:ring-0"
                placeholder="Paste token from claude setup-token"
              />
              <IconButton
                type="button"
                onClick={onToggleOAuthTokenVisible}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-subtext hover:text-text"
                variant="ghost"
                size="xs"
                label={oauthTokenVisible ? "Hide token" : "Show token"}
                icon={oauthTokenVisible ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-5 0-9.27-3.11-11-7.5a11.72 11.72 0 013.168-4.477M6.343 6.343A9.97 9.97 0 0112 5c5 0 9.27 3.11 11 7.5a11.72 11.72 0 01-4.168 4.477M6.343 6.343L3 3m3.343 3.343l2.829 2.829m4.486 4.486l2.829 2.829M3 3l18 18m-9-5.5a2.5 2.5 0 01-2.45-3" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              />
            </div>
            <p className="text-xs text-subtext mt-1">
              Optional. Run <code>claude setup-token</code> to generate a long-lived OAuth token.
              Only needed for long-running automations to avoid token expiry.
            </p>
          </div>

          <section className="rounded-md border border-surface p-3 bg-main/40 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-text">Automations (Beta)</h3>
                <p className="text-xs text-subtext mt-1">
                  Manual-only mode. Scheduler and Work tab integration are intentionally disabled.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  onClick={onOpenCreateAutomation}
                  variant="primary"
                  size="sm"
                  className="px-2.5 py-1.5 text-xs rounded bg-primary text-primary-foreground hover:bg-primary/80"
                >
                  New automation
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    void onRefreshAutomations();
                  }}
                  variant="secondary"
                  size="sm"
                  className="px-2.5 py-1.5 text-xs rounded border border-surface text-text hover:bg-surface"
                  disabled={automationsLoading}
                >
                  {automationsLoading ? "Refreshing..." : "Refresh"}
                </Button>
              </div>
            </div>

            {(automationsError || automationActionError) && (
              <ErrorBanner>{automationsError ?? automationActionError}</ErrorBanner>
            )}

            {automations.length === 0 && !automationsError && (
              <EmptyState bordered className="py-6">
                No automations yet.
              </EmptyState>
            )}

            <div className="space-y-2">
              {automations.map((automation) => {
                const latestRun = latestRunByAutomationId.get(automation.id);
                return (
                  <AutomationCard
                    key={automation.id}
                    className="bg-main/60"
                    name={
                      <div className="text-sm text-text font-semibold truncate">{automation.name}</div>
                    }
                    metadata={
                      <div className="text-xs text-subtext mt-1 space-y-1">
                        <div>
                          {automation.agent.toUpperCase()} - every {automation.intervalHours}h -{" "}
                          {automation.enabled ? "Enabled" : "Disabled"}
                        </div>
                        <div>
                          Last run: {formatDateTime(latestRun?.endedAtMs ?? automation.lastRunAtMs)}
                        </div>
                      </div>
                    }
                    status={formatRunStatus(latestRun?.status)}
                    actions={
                      <>
                        <Button
                          onClick={() => {
                            void onRunAutomationNow(automation.id);
                          }}
                          disabled={automationActionInFlightId === automation.id}
                          size="sm"
                          variant="secondary"
                        >
                          {automationActionInFlightId === automation.id ? "Running..." : "Run now"}
                        </Button>
                        <Button
                          onClick={() => onEditAutomation(automation.id)}
                          disabled={automationActionInFlightId === automation.id}
                          size="sm"
                          variant="secondary"
                        >
                          Edit
                        </Button>
                        <Button
                          onClick={() => {
                            void onDeleteAutomation(automation.id);
                          }}
                          disabled={automationActionInFlightId === automation.id}
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

          <div>
            <label className="block text-sm font-medium text-text mb-2">
              Keyboard Shortcuts
            </label>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between px-3 py-2 bg-main border border-surface rounded">
                <span className="text-subtext">Toggle Sidebar</span>
                <Kbd className="px-2">Cmd B</Kbd>
              </div>
              <div className="flex justify-between px-3 py-2 bg-main border border-surface rounded">
                <span className="text-subtext">Quick Switcher</span>
                <Kbd className="px-2">Cmd K</Kbd>
              </div>
              <div className="flex justify-between px-3 py-2 bg-main border border-surface rounded">
                <span className="text-subtext">Open Work Inbox</span>
                <Kbd className="px-2">Cmd I</Kbd>
              </div>
              <div className="flex justify-between px-3 py-2 bg-main border border-surface rounded">
                <span className="text-subtext">New Divergence</span>
                <Kbd className="px-2">Cmd T</Kbd>
              </div>
              <div className="flex justify-between px-3 py-2 bg-main border border-surface rounded">
                <span className="text-subtext">Close Terminal</span>
                <Kbd className="px-2">Cmd W</Kbd>
              </div>
              <div className="flex justify-between px-3 py-2 bg-main border border-surface rounded">
                <span className="text-subtext">Switch Tab</span>
                <Kbd className="px-2">Cmd 1-9</Kbd>
              </div>
              <div className="flex justify-between px-3 py-2 bg-main border border-surface rounded">
                <span className="text-subtext">Previous/Next Tab</span>
                <Kbd className="px-2">Cmd [ / ]</Kbd>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-text mb-2">
              About / Updates
            </label>
            <div className="space-y-3">
              {appVersion && (
                <p className="text-sm text-subtext">
                  Current version: <span className="text-text font-medium">v{appVersion}</span>
                </p>
              )}

              <p className="text-sm text-subtext">
                <span className={updaterPresentation.isError ? "text-red-400" : undefined}>
                  {updaterPresentation.message}
                </span>
              </p>

              {updaterPresentation.showProgress && (
                <ProgressBar
                  value={updater.progress}
                  className="w-full"
                  barClassName="bg-accent"
                />
              )}

              <div className="flex gap-2">
                {updaterPresentation.showCheckButton && (
                  <Button
                    onClick={updater.checkForUpdate}
                    variant="secondary"
                    size="sm"
                    className="px-3 py-1.5 text-sm border border-surface rounded hover:bg-surface text-text"
                  >
                    Check for Updates
                  </Button>
                )}
                {updaterPresentation.showInstallButton && (
                  <Button
                    onClick={updater.downloadAndInstall}
                    variant="primary"
                    size="sm"
                    className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/80"
                  >
                    Install and Restart
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>

        <ModalFooter className="p-4 justify-end">
          <Button
            onClick={onClose}
            variant="ghost"
            size="md"
          >
            Cancel
          </Button>
          <Button
            onClick={onSave}
            variant="primary"
            size="md"
          >
            Save
          </Button>
        </ModalFooter>

      {isEditorOpen && (
        <AutomationEditorModal
          projects={projects}
          automationForm={automationForm}
          automationFormError={automationFormError}
          isSubmittingAutomation={isSubmittingAutomation}
          automationSubmitLabel={automationSubmitLabel}
          onAutomationFormChange={onAutomationFormChange}
          onSubmitAutomationForm={onSubmitAutomationForm}
          onCloseAutomationEditor={onCloseAutomationEditor}
        />
      )}
    </ModalShell>
  );
}

export default SettingsPresentational;
