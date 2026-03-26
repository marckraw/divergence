import { invoke } from "@tauri-apps/api/core";

export interface FileListResult {
  files: string[];
  truncated: boolean;
}

const fileListCache = new Map<string, FileListResult>();
const inFlightFileListRequests = new Map<string, Promise<FileListResult>>();

function getFileListCacheKey(
  rootPath: string,
  excludePatterns: string[],
  respectGitignore: boolean,
): string {
  return JSON.stringify({
    rootPath,
    excludePatterns: [...excludePatterns],
    respectGitignore,
  });
}

export async function listProjectFiles(
  rootPath: string,
  excludePatterns: string[],
  respectGitignore: boolean,
): Promise<FileListResult> {
  const cacheKey = getFileListCacheKey(rootPath, excludePatterns, respectGitignore);
  const cached = fileListCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const pending = inFlightFileListRequests.get(cacheKey);
  if (pending) {
    return pending;
  }

  const request = invoke<FileListResult>("list_project_files", {
    rootPath,
    excludePatterns,
    respectGitignore,
  })
    .then((result) => {
      fileListCache.set(cacheKey, result);
      return result;
    })
    .finally(() => {
      inFlightFileListRequests.delete(cacheKey);
    });

  inFlightFileListRequests.set(cacheKey, request);
  return request;
}
