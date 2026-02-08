import { useCallback, useMemo, useState } from "react";
import type { Automation } from "../../../entities/automation";
import AutomationsPanelPresentational from "./AutomationsPanel.presentational";
import type { AutomationFormState, AutomationsPanelProps } from "./AutomationsPanel.types";

const EMPTY_FORM: AutomationFormState = {
  id: null,
  name: "",
  projectId: null,
  agent: "claude",
  prompt: "",
  intervalHours: 5,
  enabled: true,
};

function toFormState(automation: Automation): AutomationFormState {
  return {
    id: automation.id,
    name: automation.name,
    projectId: automation.projectId,
    agent: automation.agent,
    prompt: automation.prompt,
    intervalHours: automation.intervalHours,
    enabled: automation.enabled,
  };
}

function AutomationsPanelContainer(props: AutomationsPanelProps) {
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [form, setForm] = useState<AutomationFormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleFormChange = useCallback(<K extends keyof AutomationFormState>(
    key: K,
    value: AutomationFormState[K]
  ) => {
    setForm((previous) => ({ ...previous, [key]: value }));
    if (formError) {
      setFormError(null);
    }
  }, [formError]);

  const resetForm = useCallback(() => {
    setForm(EMPTY_FORM);
    setFormError(null);
  }, []);

  const openCreateTemplate = useCallback(() => {
    resetForm();
    setIsEditorOpen(true);
  }, [resetForm]);

  const closeEditor = useCallback(() => {
    resetForm();
    setIsEditorOpen(false);
  }, [resetForm]);

  const validateForm = useCallback((): string | null => {
    if (!form.name.trim()) {
      return "Name is required.";
    }
    if (!form.projectId) {
      return "Project is required.";
    }
    if (!form.prompt.trim()) {
      return "Prompt is required.";
    }
    if (!Number.isFinite(form.intervalHours) || form.intervalHours < 1) {
      return "Interval must be at least 1 hour.";
    }
    return null;
  }, [form]);

  const handleSubmitForm = useCallback(async () => {
    const validationError = validateForm();
    if (validationError) {
      setFormError(validationError);
      return;
    }

    setIsSubmitting(true);
    try {
      if (form.id === null) {
        await props.onCreateAutomation({
          name: form.name.trim(),
          projectId: form.projectId!,
          agent: form.agent,
          prompt: form.prompt.trim(),
          intervalHours: Math.floor(form.intervalHours),
          enabled: form.enabled,
        });
      } else {
        await props.onUpdateAutomation({
          id: form.id,
          name: form.name.trim(),
          projectId: form.projectId!,
          agent: form.agent,
          prompt: form.prompt.trim(),
          intervalHours: Math.floor(form.intervalHours),
          enabled: form.enabled,
        });
      }
      closeEditor();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Failed to save automation.");
    } finally {
      setIsSubmitting(false);
    }
  }, [closeEditor, form, props, validateForm]);

  const handleEditAutomation = useCallback((automationId: number) => {
    const automation = props.automations.find((item) => item.id === automationId);
    if (!automation) {
      return;
    }
    setForm(toFormState(automation));
    setFormError(null);
    setIsEditorOpen(true);
  }, [props.automations]);

  const submitLabel = useMemo(() => {
    return form.id === null ? "Create automation" : "Save automation";
  }, [form.id]);

  return (
    <AutomationsPanelPresentational
      {...props}
      isEditorOpen={isEditorOpen}
      form={form}
      formError={formError}
      isSubmitting={isSubmitting}
      submitLabel={submitLabel}
      cancelEditVisible={form.id !== null}
      onOpenCreateTemplate={openCreateTemplate}
      onFormChange={handleFormChange}
      onSubmitForm={handleSubmitForm}
      onCloseEditor={closeEditor}
      onEditAutomation={handleEditAutomation}
    />
  );
}

export default AutomationsPanelContainer;
