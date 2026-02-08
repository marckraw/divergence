import { invoke } from "@tauri-apps/api/core";
import { deleteDivergence } from "../../../entities/divergence";

export async function deleteDivergenceFiles(path: string): Promise<void> {
  await invoke("delete_divergence", { path });
}

export async function deleteDivergenceRecord(divergenceId: number): Promise<void> {
  await deleteDivergence(divergenceId);
}
