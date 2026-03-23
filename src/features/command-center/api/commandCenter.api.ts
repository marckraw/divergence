import { invoke } from "@tauri-apps/api/core";

export interface CommandCenterFileListResult {
  files: string[];
  truncated: boolean;
}

export async function listCommandCenterFiles(rootPath: string): Promise<CommandCenterFileListResult> {
  return invoke<CommandCenterFileListResult>("list_project_files", { rootPath });
}
