const DEFAULT_RANGE_START = 3100;
const DEFAULT_RANGE_END = 3999;

export function findNextFreePort(
  allocatedPorts: Set<number>,
  preferredPort?: number,
  rangeStart: number = DEFAULT_RANGE_START,
  rangeEnd: number = DEFAULT_RANGE_END,
): number | null {
  if (preferredPort !== undefined && preferredPort >= rangeStart && preferredPort <= rangeEnd) {
    if (!allocatedPorts.has(preferredPort)) {
      return preferredPort;
    }
  }

  for (let port = rangeStart; port <= rangeEnd; port++) {
    if (!allocatedPorts.has(port)) {
      return port;
    }
  }

  return null;
}

export function buildProxyHostname(projectName: string, branchName: string): string {
  const sanitize = (name: string) =>
    name
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");

  const branch = sanitize(branchName);
  const project = sanitize(projectName);

  return `${branch}.${project}.divergence.localhost`;
}
