import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";

export async function getNotificationPermissionGranted(): Promise<boolean> {
  return isPermissionGranted();
}

export async function requestNotificationPermission(): Promise<string> {
  return requestPermission();
}

export function sendDesktopNotification(title: string, body: string): void {
  sendNotification({ title, body });
}
