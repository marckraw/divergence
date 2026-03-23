import { invoke } from "@tauri-apps/api/core";

export interface FileListResult {
  files: string[];
  truncated: boolean;
}

export async function listProjectFiles(rootPath: string): Promise<FileListResult> {
  return invoke<FileListResult>("list_project_files", { rootPath });
}
