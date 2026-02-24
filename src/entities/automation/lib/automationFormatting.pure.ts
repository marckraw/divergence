export function formatRunStatus(status?: string): string {
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
