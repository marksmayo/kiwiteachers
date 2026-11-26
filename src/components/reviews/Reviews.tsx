import Link from "next/link";
import { MessageSquareText } from "lucide-react";
import { listReviews } from "@/lib/reviews";
import { Stars } from "../Stars";
import { ReviewForm } from "./ReviewForm";

export function displayName(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length < 2) return parts[0] || "Teacher";
  return `${parts[0]} ${parts[parts.length - 1].charAt(0)}.`;
}

export async function Reviews({
  resourceId,
  slug,
  viewerId,
  myScore,
}: {
  resourceId: string;
  slug: string;
  viewerId: string | null;
  myScore: number | null;
}) {
  const reviews = await listReviews(resourceId, viewerId);
  const mine = viewerId ? reviews.find((r) => r.user_id === viewerId) : undefined;
  const others = reviews.filter((r) => r.user_id !== viewerId);

  return (
    <section className="mt-16" aria-labelledby="reviews-heading">
      <h2 id="reviews-heading" className="mb-5 flex items-center gap-2 text-2xl font-bold">
        <MessageSquareText className="h-6 w-6 text-fern" /> Teacher reviews
        <span className="text-base font-normal text-muted">({others.length + (mine?.review_status === "published" ? 1 : 0)})</span>
      </h2>

      <div className="mb-6 max-w-2xl">
        {viewerId ? (
          <>
            {mine && mine.review_status !== "published" && (
              <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
                {mine.review_status === "flagged"
                  ? "Your review is waiting for a moderator to check it."
                  : "Your review was hidden by a moderator. You can edit it to resubmit."}
              </p>
            )}
            <ReviewForm resourceId={resourceId} initialScore={mine?.score ?? myScore} initialBody={mine?.body ?? null} />
          </>
        ) : (
          <p className="text-sm text-muted">
            <Link href={`/sign-in?next=/resources/${slug}`} className="font-semibold text-fern hover:underline">Sign in</Link> to write a review.
          </p>
        )}
      </div>

      {reviews.length === 0 ? (
        <p className="text-sm text-muted">No reviews yet.</p>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {(mine ? [mine, ...others] : others).map((r) => (
            <li key={r.user_id} className="card p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-kiwi/90 text-sm font-bold text-white">
                    {r.author.charAt(0).toUpperCase()}
                  </span>
                  <div>
                    <div className="text-sm font-semibold">
                      {displayName(r.author)} {r.user_id === viewerId && <span className="font-normal text-muted">(you)</span>}
                    </div>
                    <time className="text-xs text-muted" dateTime={new Date(r.updated_at).toISOString()}>
                      {new Date(r.updated_at).toLocaleDateString("en-NZ", { day: "numeric", month: "short", year: "numeric" })}
                    </time>
                  </div>
                </div>
                <Stars value={r.score} size={15} />
              </div>
              <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-ink/85">{r.body}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
