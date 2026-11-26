"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Star } from "lucide-react";
import { rateResource } from "@/app/actions";
import { Stars } from "./Stars";

const LABELS: Record<number, string> = {
  0.5: "Not useful", 1: "Poor", 1.5: "Below average", 2: "Fair", 2.5: "Okay", 3: "Good",
  3.5: "Very good", 4: "Great", 4.5: "Excellent", 5: "Ka pai! Outstanding",
};

export function RatingInput({
  resourceId,
  initialAvg,
  initialCount,
  initialMine,
  signedIn,
  returnTo,
}: {
  resourceId: string;
  initialAvg: number | null;
  initialCount: number;
  initialMine: number | null;
  signedIn: boolean;
  returnTo: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [mine, setMine] = useState<number | null>(initialMine);
  const [avg, setAvg] = useState(initialAvg);
  const [count, setCount] = useState(initialCount);
  const [hover, setHover] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = (score: number | null) => {
    if (!signedIn) {
      router.push(`/sign-in?next=${encodeURIComponent(returnTo)}`);
      return;
    }
    const prev = mine;
    setMine(score);
    setError(null);
    start(async () => {
      const res = await rateResource(resourceId, score);
      if (!res.ok) {
        setMine(prev);
        if (res.error === "signin") router.push(`/sign-in?next=${encodeURIComponent(returnTo)}`);
        else setError(res.error);
        return;
      }
      setAvg(res.rating_avg);
      setCount(res.rating_count);
    });
  };

  const valueFromEvent = (e: React.MouseEvent<HTMLButtonElement>, i: number) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return e.clientX - rect.left < rect.width / 2 ? i + 0.5 : i + 1;
  };

  const shown = hover ?? mine ?? 0;
  const size = 30;

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-muted">Teacher rating</div>
          {count > 0 && avg !== null ? (
            <div className="mt-1 flex items-center gap-2">
              <Stars value={avg} size={18} />
              <span className="font-display text-lg font-bold">{avg.toFixed(1)}</span>
              <span className="text-sm text-muted">from {count} rating{count === 1 ? "" : "s"}</span>
            </div>
          ) : (
            <div className="mt-1 text-sm text-muted">No ratings yet — be the first!</div>
          )}
        </div>
      </div>

      <div className="mt-4 border-t border-line pt-4">
        <div className="mb-1.5 text-sm font-medium">{mine ? "Your rating" : "Rate this resource"}</div>
        <div className="flex flex-wrap items-center gap-3">
          <div
            role="slider"
            tabIndex={0}
            aria-label="Your rating"
            aria-valuemin={0.5}
            aria-valuemax={5}
            aria-valuenow={mine ?? undefined}
            aria-valuetext={mine ? `${mine} out of 5 stars` : "Not rated"}
            className={`flex rounded-lg outline-none focus-visible:ring-4 focus-visible:ring-fern/20 ${pending ? "opacity-70" : ""}`}
            onMouseLeave={() => setHover(null)}
            onKeyDown={(e) => {
              const cur = mine ?? 0;
              if (e.key === "ArrowRight" || e.key === "ArrowUp") { e.preventDefault(); submit(Math.min(5, cur + 0.5)); }
              if (e.key === "ArrowLeft" || e.key === "ArrowDown") { e.preventDefault(); if (cur > 0.5) submit(cur - 0.5); }
            }}
          >
            {[0, 1, 2, 3, 4].map((i) => {
              const fill = Math.max(0, Math.min(1, shown - i));
              return (
                <button
                  key={i}
                  type="button"
                  tabIndex={-1}
                  className="relative px-0.5 transition hover:scale-110"
                  style={{ width: size + 4, height: size }}
                  onMouseMove={(e) => setHover(valueFromEvent(e, i))}
                  onClick={(e) => submit(valueFromEvent(e, i))}
                  aria-label={`${i + 1} stars`}
                >
                  <Star className="absolute left-0.5 top-0 text-line" fill="currentColor" strokeWidth={0} style={{ width: size, height: size }} />
                  {fill > 0 && (
                    <span className="absolute left-0.5 top-0 overflow-hidden" style={{ width: size * fill, height: size }}>
                      <Star className={hover !== null ? "text-amber-400" : "text-amber-500"} fill="currentColor" strokeWidth={0} style={{ width: size, height: size }} />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <span className="min-w-28 text-sm text-muted">
            {shown ? `${shown.toFixed(1)} · ${LABELS[shown]}` : signedIn ? "Tap a star (half stars too)" : "Sign in to rate"}
          </span>
        </div>
        {mine !== null && hover === null && (
          <button onClick={() => submit(null)} disabled={pending} className="mt-2 text-xs text-muted hover:text-pohutukawa hover:underline">
            Remove my rating
          </button>
        )}
        {error && <p className="mt-2 text-xs text-pohutukawa">{error}</p>}
      </div>
    </div>
  );
}
