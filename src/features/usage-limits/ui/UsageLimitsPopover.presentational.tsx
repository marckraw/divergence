import UsageBar from "./UsageBar.presentational";
import { formatTimeSince } from "../model/usageLimits.pure";
import type { UsageLimitsPopoverProps } from "./UsageLimitsPopover.types";

function UsageLimitsPopover({
  claude,
  codex,
  status,
  loading,
  lastFetchedAtMs,
  onRefresh,
}: UsageLimitsPopoverProps) {
  const hasAnyCreds =
    status?.claudeCredentialsFound || status?.codexCredentialsFound;

  return (
    <div className="w-80 bg-sidebar border border-surface rounded-lg shadow-lg p-3 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-text">Usage Limits</h3>
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          className="text-xs text-subtext hover:text-text transition-colors disabled:opacity-40"
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {!hasAnyCreds && (
        <p className="text-xs text-subtext py-2">
          No credentials found. Log in to Claude Code or Codex CLI to see usage.
        </p>
      )}

      {status?.claudeCredentialsFound && (
        <div className="space-y-2">
          <h4 className="text-xs font-medium text-text">Claude Code</h4>
          {claude?.error && (
            <p className="text-xs text-red">{claude.error}</p>
          )}
          {claude?.available &&
            claude.windows.map((w) => (
              <UsageBar
                key={w.label}
                label={w.label}
                utilization={w.utilization}
                resetsAt={w.resetsAt}
              />
            ))}
          {claude?.available && claude.windows.length === 0 && (
            <p className="text-xs text-subtext">No usage data available</p>
          )}
          {!claude && !loading && (
            <p className="text-xs text-subtext">Not fetched yet</p>
          )}
        </div>
      )}

      {status?.codexCredentialsFound && (
        <div className="space-y-2">
          <h4 className="text-xs font-medium text-text">
            Codex{codex?.planType ? ` (${codex.planType})` : ""}
          </h4>
          {codex?.error && <p className="text-xs text-red">{codex.error}</p>}
          {codex?.available &&
            codex.windows.map((w) => (
              <UsageBar
                key={w.label}
                label={w.label}
                utilization={w.utilization}
                resetsAt={w.resetsAt}
              />
            ))}
          {codex?.available && codex.windows.length === 0 && (
            <p className="text-xs text-subtext">No usage data available</p>
          )}
          {!codex && !loading && (
            <p className="text-xs text-subtext">Not fetched yet</p>
          )}
        </div>
      )}

      <p className="text-[10px] text-subtext pt-1 border-t border-surface">
        Updated {formatTimeSince(lastFetchedAtMs)}
      </p>
    </div>
  );
}

export default UsageLimitsPopover;
