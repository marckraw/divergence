import { useState, useEffect, useCallback } from "react";
import { check, Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

export type UpdateStatus =
  | "idle"
  | "checking"
  | "available"
  | "downloading"
  | "installed"
  | "error";

interface UpdaterState {
  status: UpdateStatus;
  version: string | null;
  progress: number;
  error: string | null;
  checkForUpdate: () => Promise<void>;
  downloadAndInstall: () => Promise<void>;
}

export function useUpdater(checkOnMount = false): UpdaterState {
  const [status, setStatus] = useState<UpdateStatus>("idle");
  const [version, setVersion] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [update, setUpdate] = useState<Update | null>(null);

  const checkForUpdate = useCallback(async () => {
    setStatus("checking");
    setError(null);
    try {
      const result = await check();

      if (result) {
        setUpdate(result);
        setVersion(result.version);
        setStatus("available");
      } else {
        setStatus("idle");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    if (!checkOnMount) return;

    let cancelled = false;

    async function doCheck() {
      setStatus("checking");
      setError(null);
      try {
        const result = await check();
        if (cancelled) return;

        if (result) {
          setUpdate(result);
          setVersion(result.version);
          setStatus("available");
        } else {
          setStatus("idle");
        }
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
        setStatus("error");
      }
    }

    doCheck();
    return () => {
      cancelled = true;
    };
  }, [checkOnMount]);

  const downloadAndInstall = useCallback(async () => {
    if (!update) return;

    setStatus("downloading");
    setProgress(0);

    try {
      let totalBytes = 0;
      let downloadedBytes = 0;

      await update.downloadAndInstall((event) => {
        if (event.event === "Started" && event.data.contentLength) {
          totalBytes = event.data.contentLength;
        } else if (event.event === "Progress") {
          downloadedBytes += event.data.chunkLength;
          if (totalBytes > 0) {
            setProgress(Math.round((downloadedBytes / totalBytes) * 100));
          }
        }
      });

      setStatus("installed");
      await relaunch();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus("error");
    }
  }, [update]);

  return { status, version, progress, error, checkForUpdate, downloadAndInstall };
}
