import { invoke } from "@tauri-apps/api/core";

export async function getDivergenceBasePath(): Promise<string> {
  return invoke<string>("get_divergence_base_path");
}
