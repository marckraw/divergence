import { invoke } from "@tauri-apps/api/core";
import { markDivergenceAsDiverged as markDivergenceAsDivergedInDb } from "../../../entities/divergence";

export interface BranchStatus {
  merged: boolean;
  diverged: boolean;
}

export async function checkBranchStatus(path: string, branch: string): Promise<BranchStatus> {
  return invoke<BranchStatus>("check_branch_status", {
    path,
    branch,
  });
}

export async function markDivergenceAsDiverged(divergenceId: number): Promise<void> {
  await markDivergenceAsDivergedInDb(divergenceId);
}
