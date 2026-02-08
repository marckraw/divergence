import { isPermissionGranted, requestPermission, sendNotification } from "@tauri-apps/plugin-notification";

type PermissionState = "unknown" | "granted" | "denied";

let permissionState: PermissionState = "unknown";
let permissionRequestInFlight: Promise<boolean> | null = null;

async function ensureNotificationPermission(): Promise<boolean> {
  if (permissionState === "granted") {
    return true;
  }

  if (permissionState === "denied") {
    return false;
  }

  if (permissionRequestInFlight) {
    return permissionRequestInFlight;
  }

  permissionRequestInFlight = (async () => {
    try {
      const alreadyGranted = await isPermissionGranted();
      if (alreadyGranted) {
        permissionState = "granted";
        return true;
      }

      const permission = await requestPermission();
      const granted = permission === "granted";
      permissionState = granted ? "granted" : "denied";
      return granted;
    } catch (error) {
      console.warn("Notifications are unavailable:", error);
      permissionState = "denied";
      return false;
    } finally {
      permissionRequestInFlight = null;
    }
  })();

  return permissionRequestInFlight;
}

export async function notifyCommandFinished(title: string, body: string): Promise<void> {
  const allowed = await ensureNotificationPermission();
  if (!allowed) {
    return;
  }

  try {
    sendNotification({ title, body });
  } catch (error) {
    console.warn("Failed to send notification:", error);
  }
}
