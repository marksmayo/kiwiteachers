"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { rateResource } from "@/app/actions";
import { Stars } from "./Stars";
import { StarPicker, STAR_LABELS } from "./StarPicker";

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
      if (score === null) router.refresh();
    });
  };

  const shown = hover ?? mine ?? 0;

  return (
    <div className="card p-4">
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

      <div className="mt-4 border-t border-line pt-4">
        <div className="mb-1.5 text-sm font-medium">{mine ? "Your rating" : "Rate this resource"}</div>
        <div className="flex flex-wrap items-center gap-3">
          <StarPicker value={mine} onChange={submit} disabled={pending} onHoverChange={setHover} />
          <span className="min-w-28 text-sm text-muted">
            {shown ? `${shown.toFixed(1)} · ${STAR_LABELS[shown]}` : signedIn ? "Tap a star (half stars too)" : "Sign in to rate"}
          </span>
        </div>
        {mine !== null && hover === null && (
          <button onClick={() => submit(null)} disabled={pending} className="mt-2 text-xs text-muted hover:text-pohutukawa hover:underline">
            Remove my rating (and review)
          </button>
        )}
        {error && <p className="mt-2 text-xs text-pohutukawa">{error}</p>}
      </div>
    </div>
  );
}
