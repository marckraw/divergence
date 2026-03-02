import { listen } from "@tauri-apps/api/event";

/**
 * Subscribe to the "mobile-handshake" Tauri event emitted by the WS server
 * when a mobile device connects and may need pairing.
 *
 * Returns a cleanup function that removes the listener.
 */
export async function onMobileHandshake(callback: () => void): Promise<() => void> {
  return listen("mobile-handshake", callback);
}
