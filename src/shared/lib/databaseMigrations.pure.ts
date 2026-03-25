export type Migration13RecoveryAction =
  | "none"
  | "rename_v13_to_automations_and_mark_complete"
  | "drop_stale_v13";
export type Migration14RecoveryAction =
  | "none"
  | "rename_v14_to_automations_and_mark_complete"
  | "drop_stale_v14";

interface Migration13RecoveryInput {
  currentVersion: number;
  hasAutomations: boolean;
  hasAutomationsV13: boolean;
}

interface Migration14RecoveryInput {
  currentVersion: number;
  hasAutomations: boolean;
  hasAutomationsV14: boolean;
}

export function getMigration13RecoveryAction(
  input: Migration13RecoveryInput
): Migration13RecoveryAction {
  if (input.currentVersion >= 13) {
    return "none";
  }

  if (!input.hasAutomations && input.hasAutomationsV13) {
    return "rename_v13_to_automations_and_mark_complete";
  }

  if (input.hasAutomations && input.hasAutomationsV13) {
    return "drop_stale_v13";
  }

  return "none";
}

export function getMigration14RecoveryAction(
  input: Migration14RecoveryInput
): Migration14RecoveryAction {
  if (input.currentVersion >= 14) {
    return "none";
  }

  if (!input.hasAutomations && input.hasAutomationsV14) {
    return "rename_v14_to_automations_and_mark_complete";
  }

  if (input.hasAutomations && input.hasAutomationsV14) {
    return "drop_stale_v14";
  }

  return "none";
}
