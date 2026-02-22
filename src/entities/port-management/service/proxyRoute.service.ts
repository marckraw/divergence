import { addProxyRoute, isCaddyRunning, removeProxyRoute } from "../../../shared/api/proxy.api";
import { getPortAllocation, updateProxyHostname } from "../api/portAllocation.api";
import { buildProxyHostname } from "../lib/portScanner.pure";

type ProxyEntityType = "divergence" | "workspace_divergence";

interface EnsureProxyForEntityInput {
  entityType: ProxyEntityType;
  entityId: number;
  scopeName: string;
  branchName: string;
  targetPort: number;
}

export async function ensureProxyForEntity({
  entityType,
  entityId,
  scopeName,
  branchName,
  targetPort,
}: EnsureProxyForEntityInput): Promise<string> {
  const hostname = buildProxyHostname(scopeName, branchName);
  await updateProxyHostname(entityType, entityId, hostname);

  if (!(await isCaddyRunning())) {
    return hostname;
  }

  // Replace stale routes if they exist, then add the fresh mapping.
  await removeProxyRoute(hostname);
  await addProxyRoute(hostname, targetPort);
  return hostname;
}

export async function cleanupProxyForEntity(
  entityType: ProxyEntityType,
  entityId: number,
): Promise<void> {
  const allocation = await getPortAllocation(entityType, entityId);
  const hostname = allocation?.proxyHostname?.trim() ?? "";
  if (!hostname) {
    return;
  }

  if (!(await isCaddyRunning())) {
    return;
  }

  await removeProxyRoute(hostname);
}
