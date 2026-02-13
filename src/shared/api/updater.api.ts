import { relaunch } from "@tauri-apps/plugin-process";
import { check, type Update } from "@tauri-apps/plugin-updater";

export type AppUpdate = Update;

export async function checkForAppUpdate(): Promise<AppUpdate | null> {
  return check();
}

export async function relaunchApp(): Promise<void> {
  await relaunch();
}
