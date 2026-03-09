export type Migration13RecoveryAction =
  | "none"
  | "rename_v13_to_automations_and_mark_complete"
  | "drop_stale_v13";

interface Migration13RecoveryInput {
  currentVersion: number;
  hasAutomations: boolean;
  hasAutomationsV13: boolean;
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
