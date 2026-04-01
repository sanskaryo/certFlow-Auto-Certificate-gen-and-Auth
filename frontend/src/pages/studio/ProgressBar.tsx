interface ProgressBarProps {
  total: number;
  success: number;
  failed: number;
}

export default function ProgressBar({ total, success, failed }: ProgressBarProps) {
  const percent = total === 0 ? 0 : Math.round(((success + failed) / total) * 100);

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-studio-heading">Generating Certificates...</p>
      <div className="w-full bg-studio-border rounded-full h-2.5 overflow-hidden">
        <div
          className="bg-prime-600 h-2.5 rounded-full transition-all duration-300"
          style={{ width: `${percent}%` }}
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
      <p className="text-xs text-studio-label">
        Success: {success}&nbsp;&nbsp;Failed: {failed}
      </p>
    </div>
  );
}
