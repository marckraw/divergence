import { Button } from "../../../shared";
import type { RemoteSessionDisplay } from "../model/remoteAccess.types";

interface Props {
  sessions: RemoteSessionDisplay[];
  onRevoke: (sessionId: number) => void;
  onRevokeAll: () => void;
}

export default function ConnectedDevicesList({ sessions, onRevoke, onRevokeAll }: Props) {
  if (sessions.length === 0) {
    return (
      <div className="py-4 text-center">
        <span className="text-xs text-subtext">No connected devices</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-between items-center">
        <span className="text-xs font-medium text-text">
          Connected Devices ({sessions.length})
        </span>
        {sessions.length > 1 && (
          <Button variant="danger" size="xs" onClick={onRevokeAll}>
            Revoke All
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-1">
        {sessions.map((session) => (
          <div
            key={session.id}
            className="flex justify-between items-center p-2.5 rounded-lg border border-surface bg-surface/30"
          >
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center gap-1.5 text-sm font-medium text-text">
                <span
                  className={`w-1.5 h-1.5 rounded-full inline-block ${
                    session.isActive ? "bg-green" : "bg-subtext"
                  }`}
                />
                {session.deviceName}
              </div>
              <span className="text-[11px] text-subtext">
                Paired {session.pairedAt} · Last seen {session.lastSeen}
              </span>
            </div>
            <Button variant="subtle" size="xs" onClick={() => onRevoke(session.id)}>
              Revoke
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
