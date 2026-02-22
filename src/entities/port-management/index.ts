export type {
  PortAllocation,
  PortEntityType,
  AllocatePortInput,
} from "./model/portAllocation.types";
export {
  allocatePort,
  deletePortAllocation,
  getPortAllocation,
  listAllPortAllocations,
  listPortAllocationsForProject,
  updateProxyHostname,
} from "./api/portAllocation.api";
export { checkPortAvailable } from "./api/portAvailability.api";
export { detectFrameworkForPath } from "./api/frameworkDetection.api";
export {
  buildPortEnvVars,
  detectFrameworkFromDependencies,
  getAdapterById,
  getAdapterLabels,
  FRAMEWORK_ADAPTERS,
  type FrameworkAdapter,
} from "./lib/frameworkAdapters.pure";
export {
  findNextFreePort,
  buildProxyHostname,
} from "./lib/portScanner.pure";
export {
  usePortAllocations,
  useProjectPortAllocations,
} from "./model/usePortAllocations";
export {
  cleanupProxyForEntity,
  ensureProxyForEntity,
} from "./service/proxyRoute.service";
