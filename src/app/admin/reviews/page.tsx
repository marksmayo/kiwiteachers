import Link from "next/link";
import type { Metadata } from "next";
import { Suspense } from "react";
import { AlertTriangle } from "lucide-react";
import { listFlaggedReviews } from "@/lib/reviews";
import { REASON_LABELS } from "@/lib/moderation";
import { Stars } from "@/components/Stars";
import { AdminNav, requireAdmin } from "@/components/admin/AdminNav";
import { ModerationButtons } from "@/components/admin/ModerationButtons";

export const metadata: Metadata = { title: "Flagged reviews" };

export default function FlaggedReviewsPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <h1 className="mb-1 text-3xl font-bold">Flagged reviews</h1>
      <p className="mb-6 text-muted">Reviews held back automatically for bad language, links, contact details or spam.</p>
      <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-line/40" />}>
        <Flagged />
      </Suspense>
    </div>
  );
}

async function Flagged() {
  await requireAdmin("/admin/reviews");
  const rows = await listFlaggedReviews();
  return (
    <>
      <AdminNav active="reviews" />
      {rows.length === 0 ? (
        <div className="card px-6 py-14 text-center text-muted">No flagged reviews. Ka pai!</div>
      ) : (
        <ul className="space-y-4">
          {rows.map((r) => (
            <li key={`${r.user_id}-${r.resource_id}`} className="card space-y-3 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm">
                  <strong>{r.author}</strong> <span className="text-muted">({r.author_email})</span> on{" "}
                  <Link href={`/resources/${r.resource_slug}`} className="font-semibold text-fern hover:underline">{r.resource_title}</Link>
                </div>
                <Stars value={r.score} size={15} />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {r.flag_reasons.map((reason) => (
                  <span key={reason} className="inline-flex items-center gap-1 rounded-full bg-pohutukawa/10 px-2.5 py-0.5 text-xs font-medium text-pohutukawa">
                    <AlertTriangle className="h-3 w-3" /> {REASON_LABELS[reason] ?? reason}
                  </span>
                ))}
              </div>
              <blockquote className="whitespace-pre-line rounded-lg bg-sand/70 p-3 text-sm">{r.body}</blockquote>
              <ModerationButtons userId={r.user_id} resourceId={r.resource_id} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
