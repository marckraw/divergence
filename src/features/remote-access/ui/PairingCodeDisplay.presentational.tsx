import { Button } from "../../../shared";

interface Props {
  code: string | null;
  remainingSeconds: number;
  onGenerate: () => void;
}

export default function PairingCodeDisplay({ code, remainingSeconds, onGenerate }: Props) {
  const isExpired = !code || remainingSeconds <= 0;

  return (
    <div className="flex flex-col gap-2 p-3 rounded-lg border border-surface bg-surface/30">
      <div className="flex justify-between items-center">
        <span className="text-xs font-medium text-text">Pairing Code</span>
        <Button variant="subtle" size="xs" onClick={onGenerate}>
          {code && !isExpired ? "Regenerate" : "Generate Code"}
        </Button>
      </div>

      {code && !isExpired ? (
        <div className="flex items-center justify-between">
          <span className="text-2xl font-bold font-mono tracking-widest text-text">
            {code}
          </span>
          <span className="text-xs text-yellow">
            Expires in {Math.floor(remainingSeconds / 60)}:{String(remainingSeconds % 60).padStart(2, "0")}
          </span>
        </div>
      ) : (
        <p className="text-xs text-subtext m-0">
          Generate a pairing code to connect a mobile device
        </p>
      )}
    </div>
  );
}
