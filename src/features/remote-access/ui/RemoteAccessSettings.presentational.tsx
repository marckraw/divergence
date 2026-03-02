import type { RemoteSessionDisplay } from "../model/remoteAccess.types";
import PairingCodeDisplay from "./PairingCodeDisplay.presentational";
import ConnectedDevicesList from "./ConnectedDevicesList.presentational";

interface Props {
  enabled: boolean;
  port: number;
  pairingCode: string | null;
  remainingSeconds: number;
  sessions: RemoteSessionDisplay[];
  onToggle: (enabled: boolean) => void;
  onGenerateCode: () => void;
  onRevokeSession: (sessionId: number) => void;
  onRevokeAll: () => void;
}

export default function RemoteAccessSettingsPresentational({
  enabled,
  port,
  pairingCode,
  remainingSeconds,
  sessions,
  onToggle,
  onGenerateCode,
  onRevokeSession,
  onRevokeAll,
}: Props) {
  const activeSessions = sessions.filter((s) => !s.revoked);

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-sm font-semibold text-text m-0">Remote Access</h3>
          <p className="text-xs text-subtext mt-1 m-0">
            Allow Divergence Mobile to connect over WebSocket
          </p>
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => onToggle(e.target.checked)}
            className="w-4 h-4 cursor-pointer"
          />
          <span className={`text-xs font-medium ${enabled ? "text-green" : "text-subtext"}`}>
            {enabled ? "Enabled" : "Disabled"}
          </span>
        </label>
      </div>

      {enabled && (
        <>
          <div className="flex justify-between items-center py-1">
            <span className="text-xs text-subtext">Port</span>
            <span className="text-xs font-mono text-text">{port}</span>
          </div>

          <PairingCodeDisplay
            code={pairingCode}
            remainingSeconds={remainingSeconds}
            onGenerate={onGenerateCode}
          />

          <ConnectedDevicesList
            sessions={activeSessions}
            onRevoke={onRevokeSession}
            onRevokeAll={onRevokeAll}
          />
        </>
      )}
    </div>
  );
}
