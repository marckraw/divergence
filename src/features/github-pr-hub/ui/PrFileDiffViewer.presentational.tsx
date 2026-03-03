import { LoadingSpinner } from "../../../shared";
import { getDiffLineClass, parseUnifiedDiffLines } from "../lib/githubPrHub.pure";

interface PrFileDiffViewerPresentationalProps {
  patch: string | null;
  loading: boolean;
  error: string | null;
}

function PrFileDiffViewerPresentational({
  patch,
  loading,
  error,
}: PrFileDiffViewerPresentationalProps) {
  if (loading) {
    return (
      <div className="h-full flex items-center justify-center text-sm text-subtext">
        <LoadingSpinner>Loading diff...</LoadingSpinner>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center text-sm text-red">
        {error}
      </div>
    );
  }

  if (!patch?.trim()) {
    return (
      <div className="h-full flex items-center justify-center text-sm text-subtext">
        Patch is unavailable for this file.
      </div>
    );
  }

  const lines = parseUnifiedDiffLines(patch);

  return (
    <div className="h-full w-full overflow-auto font-mono text-[11px] leading-5">
      {lines.map((line) => (
        <div key={line.index} className={`px-2 py-[1px] whitespace-pre ${getDiffLineClass(line.kind)}`}>
          {line.text === "" ? " " : line.text}
        </div>
      ))}
    </div>
  );
}

export default PrFileDiffViewerPresentational;

