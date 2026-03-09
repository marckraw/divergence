import { describe, expect, it } from "vitest";
import { getMigration13RecoveryAction } from "./databaseMigrations.pure";

describe("databaseMigrations.pure", () => {
  it("does nothing when already migrated", () => {
    expect(
      getMigration13RecoveryAction({
        currentVersion: 13,
        hasAutomations: false,
        hasAutomationsV13: true,
      })
    ).toBe("none");
  });

  it("renames partial v13 table when the source table is gone", () => {
    expect(
      getMigration13RecoveryAction({
        currentVersion: 12,
        hasAutomations: false,
        hasAutomationsV13: true,
      })
    ).toBe("rename_v13_to_automations_and_mark_complete");
  });

  it("drops stale v13 temp table when both tables exist", () => {
    expect(
      getMigration13RecoveryAction({
        currentVersion: 12,
        hasAutomations: true,
        hasAutomationsV13: true,
      })
    ).toBe("drop_stale_v13");
  });

  it("does nothing for normal pre-v13 databases", () => {
    expect(
      getMigration13RecoveryAction({
        currentVersion: 12,
        hasAutomations: true,
        hasAutomationsV13: false,
      })
    ).toBe("none");
  });
});
