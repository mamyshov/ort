export function ProgressBar({ done, total, label }: { done: number; total: number; label?: string }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className="h-2 w-full overflow-hidden rounded-full bg-zinc-200"
    >
      <div className="h-full rounded-full bg-emerald-600" style={{ width: `${pct}%` }} />
    </div>
  );
}
