import type { TerminalSession } from "../../entities";

interface StatusIndicatorProps {
  status: TerminalSession["status"] | null;
}

function StatusIndicatorPresentational({ status }: StatusIndicatorProps) {
  if (!status) {
    return <div className="w-2 h-2" />;
  }

  return (
    <div className="w-2 h-2 rounded-full flex items-center justify-center">
      {status === "idle" && (
        <div className="w-2 h-2 rounded-full bg-subtext/50" />
      )}
      {status === "active" && (
        <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
      )}
      {status === "busy" && (
        <div className="w-2 h-2 rounded-full bg-yellow animate-spin">
          <svg className="w-2 h-2" viewBox="0 0 24 24">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
              fill="none"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        </div>
      )}
    </div>
  );
}

export default StatusIndicatorPresentational;

