import {
  readDir as tauriReadDir,
  readTextFile as tauriReadTextFile,
  remove as tauriRemove,
  writeTextFile as tauriWriteTextFile,
} from "@tauri-apps/plugin-fs";

export const DEFAULT_TEXT_FILE_READ_TIMEOUT_MS = 15_000;

export interface FsDirEntry {
  name?: string | null;
  isDirectory?: boolean | null;
}

export async function readDir(path: string): Promise<FsDirEntry[]> {
  return tauriReadDir(path) as Promise<FsDirEntry[]>;
}

export async function readTextFile(path: string): Promise<string> {
  return tauriReadTextFile(path);
}

export async function readTextFileWithTimeout(
  path: string,
  timeoutMs = DEFAULT_TEXT_FILE_READ_TIMEOUT_MS,
): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(`Timed out reading file after ${timeoutMs}ms.`));
    }, timeoutMs);

    tauriReadTextFile(path).then(
      (content) => {
        clearTimeout(timeoutId);
        resolve(content);
      },
      (error) => {
        clearTimeout(timeoutId);
        reject(error);
      },
    );
  });
}

export async function writeTextFile(path: string, contents: string): Promise<void> {
  await tauriWriteTextFile(path, contents);
}

export async function remove(path: string): Promise<void> {
  await tauriRemove(path);
}
