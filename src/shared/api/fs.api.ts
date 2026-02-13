import {
  readDir as tauriReadDir,
  readTextFile as tauriReadTextFile,
  remove as tauriRemove,
  writeTextFile as tauriWriteTextFile,
} from "@tauri-apps/plugin-fs";

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

export async function writeTextFile(path: string, contents: string): Promise<void> {
  await tauriWriteTextFile(path, contents);
}

export async function remove(path: string): Promise<void> {
  await tauriRemove(path);
}
