export function normalizeBranchName(value: string): string {
  return value.trim();
}

export function validateBranchName(value: string): string | null {
  if (!normalizeBranchName(value)) {
    return "Branch name is required";
  }
  return null;
}
