import type { PortAllocation } from "../../../entities/port-management";
import { Button } from "../../../shared";

interface PortDashboardRow {
  allocation: PortAllocation;
  entityName: string;
  projectName: string | null;
  branchName: string | null;
}

interface PortDashboardPresentationalProps {
  rows: PortDashboardRow[];
  caddyRunning: boolean;
  onCopyUrl: (url: string) => void;
  onOpenInBrowser: (url: string) => void;
}

function PortDashboardPresentational({
  rows,
  caddyRunning,
  onCopyUrl,
  onOpenInBrowser,
}: PortDashboardPresentationalProps) {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-surface">
        <h2 className="text-sm font-semibold text-text">Port Allocations</h2>
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${
              caddyRunning
                ? "bg-green/10 text-green"
                : "bg-subtext/10 text-subtext"
            }`}
          >
            <span className={`inline-block w-1.5 h-1.5 rounded-full ${
              caddyRunning ? "bg-green" : "bg-subtext"
            }`} />
            {caddyRunning ? "Caddy running" : "Caddy not running"}
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {rows.length === 0 ? (
          <div className="flex items-center justify-center h-full text-subtext text-sm">
            No port allocations yet. Create a divergence to allocate a port.
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-subtext border-b border-surface">
                <th className="px-4 py-2 font-medium">Entity</th>
                <th className="px-4 py-2 font-medium">Project</th>
                <th className="px-4 py-2 font-medium">Port</th>
                <th className="px-4 py-2 font-medium">Framework</th>
                <th className="px-4 py-2 font-medium">Proxy URL</th>
                <th className="px-4 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={`${row.allocation.entityType}-${row.allocation.entityId}`}
                  className="border-b border-surface/50 hover:bg-surface/30"
                >
                  <td className="px-4 py-2">
                    <div className="flex flex-col">
                      <span className="text-text font-medium">{row.entityName}</span>
                      <span className="text-subtext text-[10px]">
                        {row.allocation.entityType}
                        {row.branchName ? ` / ${row.branchName}` : ""}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-2 text-subtext">
                    {row.projectName ?? "-"}
                  </td>
                  <td className="px-4 py-2">
                    <span className="font-mono text-accent">{row.allocation.port}</span>
                  </td>
                  <td className="px-4 py-2 text-subtext">
                    {row.allocation.framework ?? "-"}
                  </td>
                  <td className="px-4 py-2">
                    {row.allocation.proxyHostname ? (
                      <span className="font-mono text-blue text-[11px]">
                        {row.allocation.proxyHostname}
                      </span>
                    ) : (
                      <span className="text-subtext">-</span>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-1">
                      {row.allocation.proxyHostname && (
                        <>
                          <Button
                            type="button"
                            onClick={() => onCopyUrl(`http://${row.allocation.proxyHostname}`)}
                            variant="secondary"
                            size="xs"
                            className="px-1.5 py-0.5 text-[10px] rounded border border-surface text-subtext hover:text-text hover:bg-surface"
                          >
                            Copy
                          </Button>
                          <Button
                            type="button"
                            onClick={() => onOpenInBrowser(`http://${row.allocation.proxyHostname}`)}
                            variant="secondary"
                            size="xs"
                            className="px-1.5 py-0.5 text-[10px] rounded border border-surface text-subtext hover:text-text hover:bg-surface"
                          >
                            Open
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export type { PortDashboardRow, PortDashboardPresentationalProps };
export default PortDashboardPresentational;
