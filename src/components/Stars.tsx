import { Star } from "lucide-react";

/** Read-only stars; supports any fractional value (e.g. 4.3). */
export function Stars({ value, size = 16, className = "" }: { value: number; size?: number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-0.5 ${className}`} aria-hidden="true">
      {[0, 1, 2, 3, 4].map((i) => {
        const fill = Math.max(0, Math.min(1, value - i));
        return (
          <span key={i} className="relative inline-block" style={{ width: size, height: size }}>
            <Star className="absolute inset-0 text-line" fill="currentColor" strokeWidth={0} style={{ width: size, height: size }} />
            {fill > 0 && (
              <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
                <Star className="text-amber-500" fill="currentColor" strokeWidth={0} style={{ width: size, height: size }} />
              </span>
            )}
          </span>
        );
      })}
    </span>
  );
}

/** Compact "★ 4.5 (12)" summary for cards. */
export function RatingSummary({ avg, count, size = 14 }: { avg: number | null; count: number; size?: number }) {
  if (!count || avg === null) return <span className="text-xs text-muted">No ratings yet</span>;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs" aria-label={`Rated ${avg.toFixed(1)} out of 5 from ${count} rating${count === 1 ? "" : "s"}`}>
      <Stars value={avg} size={size} />
      <span className="font-semibold text-ink">{avg.toFixed(1)}</span>
      <span className="text-muted">({count})</span>
    </span>
  );
}
