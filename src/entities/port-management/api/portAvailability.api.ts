import { invoke } from "@tauri-apps/api/core";

export async function checkPortAvailable(port: number): Promise<boolean> {
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    return false;
  }

  return invoke<boolean>("check_port_available", { port });
}
