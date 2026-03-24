import { invoke } from "@tauri-apps/api/core";

export interface FileListResult {
  files: string[];
  truncated: boolean;
}

export async function listProjectFiles(
  rootPath: string,
  excludePatterns: string[],
  respectGitignore: boolean,
): Promise<FileListResult> {
  return invoke<FileListResult>("list_project_files", {
    rootPath,
    excludePatterns,
    respectGitignore,
  });
}
