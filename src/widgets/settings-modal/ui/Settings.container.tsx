import { useState, useCallback, useEffect, useMemo } from "react";
import {
  DEFAULT_APP_SETTINGS,
  normalizeTmuxHistoryLimit,
  loadAppSettings,
  saveAppSettings,
  broadcastAppSettings,
} from "../../../shared";
import { getAppVersion } from "../../../shared/api/app.api";
import { getUpdaterPresentation } from "../lib/updaterPresentation.pure";
import { getDivergenceBasePath } from "../api/settings.api";
import SettingsPresentational from "./Settings.presentational";
import type {
  SettingsAutomationFormState,
  SettingsProps,
  SettingsState,
} from "./Settings.types";

const defaultSettings: SettingsState = {
  ...DEFAULT_APP_SETTINGS,
  divergenceBasePath: "",
};

const EMPTY_AUTOMATION_FORM: SettingsAutomationFormState = {
  id: null,
  name: "",
  projectId: null,
  agent: "claude",
  prompt: "",
  intervalHours: 5,
  enabled: true,
  keepSessionAlive: false,
};

function SettingsContainer({
  onClose,
  updater,
  projects,
  automations,
  latestRunByAutomationId,
  automationsLoading,
  automationsError,
  onRefreshAutomations,
  onCreateAutomation,
  onUpdateAutomation,
  onDeleteAutomation,
  onRunAutomationNow,
}: SettingsProps) {
  const [settings, setSettings] = useState<SettingsState>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [appVersion, setAppVersion] = useState<string | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [automationForm, setAutomationForm] = useState<SettingsAutomationFormState>(EMPTY_AUTOMATION_FORM);
  const [automationFormError, setAutomationFormError] = useState<string | null>(null);
  const [automationActionError, setAutomationActionError] = useState<string | null>(null);
  const [isSubmittingAutomation, setIsSubmittingAutomation] = useState(false);
  const [automationActionInFlightId, setAutomationActionInFlightId] = useState<number | null>(null);
  const updaterPresentation = useMemo(
    () => getUpdaterPresentation(updater.status, updater.version, updater.progress, updater.error),
    [updater.status, updater.version, updater.progress, updater.error]
  );
  const automationSubmitLabel = useMemo(() => {
    return automationForm.id === null ? "Create automation" : "Save automation";
  }, [automationForm.id]);

  useEffect(() => {
    async function loadSettings() {
      try {
        const basePath = await getDivergenceBasePath();
        const storedSettings = loadAppSettings();

        setSettings({
          ...defaultSettings,
          ...storedSettings,
          divergenceBasePath: basePath,
        });
      } catch (error) {
        console.error("Failed to load settings:", error);
      } finally {
        setLoading(false);
      }
    }

    loadSettings();
  }, []);

  useEffect(() => {
    getAppVersion().then(setAppVersion).catch(() => {});
  }, []);

  const handleSave = useCallback(() => {
    const normalized = {
      ...settings,
      tmuxHistoryLimit: normalizeTmuxHistoryLimit(settings.tmuxHistoryLimit),
    };
    const saved = saveAppSettings(normalized);
    broadcastAppSettings(saved);
    onClose();
  }, [onClose, settings]);

  const handleUpdateSetting = useCallback(<K extends keyof SettingsState>(
    key: K,
    value: SettingsState[K]
  ) => {
    setSettings((previous) => ({ ...previous, [key]: value }));
  }, []);

  const handleAutomationFormChange = useCallback(<K extends keyof SettingsAutomationFormState>(
    key: K,
    value: SettingsAutomationFormState[K]
  ) => {
    setAutomationForm((previous) => ({ ...previous, [key]: value }));
    if (automationFormError) {
      setAutomationFormError(null);
    }
  }, [automationFormError]);

  const resetAutomationForm = useCallback(() => {
    setAutomationForm(EMPTY_AUTOMATION_FORM);
    setAutomationFormError(null);
  }, []);

  const handleOpenCreateAutomation = useCallback(() => {
    resetAutomationForm();
    setAutomationActionError(null);
    setIsEditorOpen(true);
  }, [resetAutomationForm]);

  const handleCloseAutomationEditor = useCallback(() => {
    resetAutomationForm();
    setIsEditorOpen(false);
  }, [resetAutomationForm]);

  const handleEditAutomation = useCallback((automationId: number) => {
    const automation = automations.find((item) => item.id === automationId);
    if (!automation) {
      return;
    }
    setAutomationForm({
      id: automation.id,
      name: automation.name,
      projectId: automation.projectId,
      agent: automation.agent,
      prompt: automation.prompt,
      intervalHours: automation.intervalHours,
      enabled: automation.enabled,
      keepSessionAlive: automation.keepSessionAlive,
    });
    setAutomationFormError(null);
    setAutomationActionError(null);
    setIsEditorOpen(true);
  }, [automations]);

  const validateAutomationForm = useCallback((): string | null => {
    if (!automationForm.name.trim()) {
      return "Name is required.";
    }
    if (!automationForm.projectId) {
      return "Project is required.";
    }
    if (!automationForm.prompt.trim()) {
      return "Prompt is required.";
    }
    if (!Number.isFinite(automationForm.intervalHours) || automationForm.intervalHours < 1) {
      return "Interval must be at least 1 hour.";
    }
    return null;
  }, [automationForm]);

  const handleSubmitAutomationForm = useCallback(async () => {
    const validationError = validateAutomationForm();
    if (validationError) {
      setAutomationFormError(validationError);
      return;
    }

    setAutomationActionError(null);
    setIsSubmittingAutomation(true);
    try {
      if (automationForm.id === null) {
        await onCreateAutomation({
          name: automationForm.name.trim(),
          projectId: automationForm.projectId!,
          agent: automationForm.agent,
          prompt: automationForm.prompt.trim(),
          intervalHours: Math.floor(automationForm.intervalHours),
          enabled: automationForm.enabled,
          keepSessionAlive: automationForm.keepSessionAlive,
        });
      } else {
        await onUpdateAutomation({
          id: automationForm.id,
          name: automationForm.name.trim(),
          projectId: automationForm.projectId!,
          agent: automationForm.agent,
          prompt: automationForm.prompt.trim(),
          intervalHours: Math.floor(automationForm.intervalHours),
          enabled: automationForm.enabled,
          keepSessionAlive: automationForm.keepSessionAlive,
        });
      }
      handleCloseAutomationEditor();
    } catch (error) {
      setAutomationFormError(error instanceof Error ? error.message : "Failed to save automation.");
    } finally {
      setIsSubmittingAutomation(false);
    }
  }, [
    automationForm,
    handleCloseAutomationEditor,
    onCreateAutomation,
    onUpdateAutomation,
    validateAutomationForm,
  ]);

  const handleRefreshAutomations = useCallback(async () => {
    setAutomationActionError(null);
    await onRefreshAutomations();
  }, [onRefreshAutomations]);

  const handleDeleteAutomation = useCallback(async (automationId: number) => {
    setAutomationActionError(null);
    setAutomationActionInFlightId(automationId);
    try {
      await onDeleteAutomation(automationId);
    } catch (error) {
      setAutomationActionError(
        error instanceof Error ? error.message : "Failed to delete automation."
      );
    } finally {
      setAutomationActionInFlightId((current) => (current === automationId ? null : current));
    }
  }, [onDeleteAutomation]);

  const handleRunAutomationNow = useCallback(async (automationId: number) => {
    setAutomationActionError(null);
    setAutomationActionInFlightId(automationId);
    try {
      await onRunAutomationNow(automationId);
    } catch (error) {
      setAutomationActionError(
        error instanceof Error ? error.message : "Failed to run automation."
      );
    } finally {
      setAutomationActionInFlightId((current) => (current === automationId ? null : current));
    }
  }, [onRunAutomationNow]);

  return (
    <SettingsPresentational
      loading={loading}
      settings={settings}
      appVersion={appVersion}
      updater={updater}
      updaterPresentation={updaterPresentation}
      projects={projects}
      automations={automations}
      latestRunByAutomationId={latestRunByAutomationId}
      automationsLoading={automationsLoading}
      automationsError={automationsError}
      automationActionError={automationActionError}
      automationActionInFlightId={automationActionInFlightId}
      isEditorOpen={isEditorOpen}
      automationForm={automationForm}
      automationFormError={automationFormError}
      isSubmittingAutomation={isSubmittingAutomation}
      automationSubmitLabel={automationSubmitLabel}
      onClose={onClose}
      onSave={handleSave}
      onUpdateSetting={handleUpdateSetting}
      onRefreshAutomations={handleRefreshAutomations}
      onOpenCreateAutomation={handleOpenCreateAutomation}
      onEditAutomation={handleEditAutomation}
      onDeleteAutomation={handleDeleteAutomation}
      onRunAutomationNow={handleRunAutomationNow}
      onAutomationFormChange={handleAutomationFormChange}
      onSubmitAutomationForm={handleSubmitAutomationForm}
      onCloseAutomationEditor={handleCloseAutomationEditor}
    />
  );
}

export default SettingsContainer;
