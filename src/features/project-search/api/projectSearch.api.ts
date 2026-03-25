import { invoke } from "@tauri-apps/api/core";

export interface ProjectSearchMatch {
  lineNumber: number;
  columnStart: number;
  columnEnd: number;
  preview: string;
}

export interface ProjectSearchFileResult {
  filePath: string;
  absolutePath: string;
  matches: ProjectSearchMatch[];
}

export interface ProjectSearchResult {
  query: string;
  files: ProjectSearchFileResult[];
  truncated: boolean;
}

export async function searchProjectFiles(
  rootPath: string,
  query: string,
  options?: {
    caseSensitive?: boolean;
    maxResults?: number;
  },
): Promise<ProjectSearchResult> {
  return invoke<ProjectSearchResult>("search_project_files", {
    rootPath,
    query,
    caseSensitive: options?.caseSensitive ?? false,
    maxResults: options?.maxResults ?? 200,
  });
}
