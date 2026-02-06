export interface FileQuickSwitcherInfo {
  fileName: string;
  directory: string;
  extension: string;
}

export function filterFilesByQuery(files: string[], query: string): string[] {
  if (!query.trim()) {
    return files;
  }
  const lowerQuery = query.toLowerCase();
  return files.filter((filePath) => filePath.toLowerCase().includes(lowerQuery));
}

export function joinRootWithRelativePath(rootPath: string, relativePath: string): string {
  const separator = rootPath.includes("\\") ? "\\" : "/";
  return `${rootPath}${separator}${relativePath}`;
}

export function getFileQuickSwitcherInfo(filePath: string): FileQuickSwitcherInfo {
  const lastSlash = Math.max(filePath.lastIndexOf("/"), filePath.lastIndexOf("\\"));
  const fileName = lastSlash >= 0 ? filePath.slice(lastSlash + 1) : filePath;
  const directory = lastSlash >= 0 ? filePath.slice(0, lastSlash) : "";
  const dotIndex = fileName.lastIndexOf(".");
  const extension = dotIndex > 0 ? fileName.slice(dotIndex + 1) : "";
  return { fileName, directory, extension };
}
