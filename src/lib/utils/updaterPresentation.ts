import type { UpdateStatus } from "../../hooks/useUpdater";

export interface UpdaterPresentation {
  message: string;
  isError: boolean;
  showProgress: boolean;
  showCheckButton: boolean;
  showInstallButton: boolean;
}

export function getUpdaterPresentation(
  status: UpdateStatus,
  version: string | null,
  progress: number,
  error: string | null
): UpdaterPresentation {
  if (status === "checking") {
    return {
      message: "Checking for updates...",
      isError: false,
      showProgress: false,
      showCheckButton: false,
      showInstallButton: false,
    };
  }

  if (status === "available") {
    return {
      message: `Update available: v${version ?? "unknown"}`,
      isError: false,
      showProgress: false,
      showCheckButton: false,
      showInstallButton: true,
    };
  }

  if (status === "downloading") {
    return {
      message: `Downloading update... ${progress}%`,
      isError: false,
      showProgress: true,
      showCheckButton: false,
      showInstallButton: false,
    };
  }

  if (status === "installed") {
    return {
      message: "Update installed, restarting...",
      isError: false,
      showProgress: false,
      showCheckButton: false,
      showInstallButton: false,
    };
  }

  if (status === "error") {
    return {
      message: error ?? "Update check failed",
      isError: true,
      showProgress: false,
      showCheckButton: true,
      showInstallButton: false,
    };
  }

  return {
    message: "Up to date",
    isError: false,
    showProgress: false,
    showCheckButton: true,
    showInstallButton: false,
  };
}
