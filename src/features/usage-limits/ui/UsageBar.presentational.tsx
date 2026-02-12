import {
  formatUtilization,
  formatResetTime,
  getUsageLevel,
  getUsageLevelBarColor,
} from "../model/usageLimits.pure";

interface UsageBarProps {
  label: string;
  utilization: number;
  resetsAt: string | null;
}

function UsageBar({ label, utilization, resetsAt }: UsageBarProps) {
  const level = getUsageLevel(utilization);
  const barColor = getUsageLevelBarColor(level);
  const widthPercent = Math.min(Math.round(utilization * 100), 100);

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-subtext">{label}</span>
        <span className="text-text font-medium">
          {formatUtilization(utilization)}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-surface overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${barColor}`}
          style={{ width: `${widthPercent}%` }}
        />
      </div>
      {resetsAt && (
        <p className="text-[10px] text-subtext">
          resets in {formatResetTime(resetsAt)}
        </p>
      )}
    </div>
  );
}

export default UsageBar;
