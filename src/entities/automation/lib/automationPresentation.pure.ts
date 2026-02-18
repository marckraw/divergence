export function formatAutomationRunStatus(status: string | undefined): string {
  if (!status) {
    return "No runs yet";
  }
  if (status === "success") {
    return "Success";
  }
  if (status === "error") {
    return "Failed";
  }
  if (status === "running") {
    return "Running";
  }
  if (status === "queued") {
    return "Queued";
  }
  if (status === "skipped") {
    return "Skipped";
  }
  return status;
}

export function formatAutomationTimestamp(
  value: number | null | undefined,
  fallback: string
): string {
  if (!value) {
    return fallback;
  }
  return new Date(value).toLocaleString();
}
