import Link from "next/link";
import type { Metadata } from "next";
import { Suspense } from "react";
import { ExternalLink } from "lucide-react";
import { listPending } from "@/lib/resources";
import { areaBySlug, formatYears, typeBySlug } from "@/lib/taxonomy";
import { ResourceThumb } from "@/components/ResourceCard";
import { AdminNav, requireAdmin } from "@/components/admin/AdminNav";
import { DecisionButtons } from "@/components/admin/DecisionButtons";

export const metadata: Metadata = { title: "Approval queue" };

export default function QueuePage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <h1 className="mb-1 text-3xl font-bold">Approval queue</h1>
      <p className="mb-6 text-muted">Contributor submissions waiting for review. Nothing here is public yet.</p>
      <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-line/40" />}>
        <Queue />
      </Suspense>
    </div>
  );
}

async function Queue() {
  await requireAdmin("/admin/queue");
  const rows = await listPending();
  return (
    <>
      <AdminNav active="queue" />
      {rows.length === 0 ? (
        <div className="card px-6 py-14 text-center text-muted">All caught up. Nothing is waiting for review.</div>
      ) : (
        <ul className="space-y-4">
          {rows.map((r) => (
            <li key={r.id} className="card flex flex-col gap-4 p-4 md:flex-row">
              <div className="h-36 w-full shrink-0 overflow-hidden rounded-lg border border-line bg-white md:w-48">
                <ResourceThumb resource={r} />
              </div>
              <div className="min-w-0 flex-1 space-y-2">
                <Link href={`/resources/${r.slug}`} className="inline-flex items-center gap-1.5 font-display text-lg font-semibold hover:text-fern">
                  {r.title} <ExternalLink className="h-4 w-4" />
                </Link>
                <p className="text-sm text-muted">
                  From <strong className="text-ink">{r.uploader_name ?? "Unknown"}</strong> ({r.uploader_email}) ·{" "}
                  {new Date(r.created_at).toLocaleString("en-NZ", { dateStyle: "medium", timeStyle: "short" })}
                </p>
                <div className="flex flex-wrap gap-x-3 text-xs text-muted">
                  <span>{formatYears(r.years)}</span>
                  <span>{r.learning_areas.map((a) => areaBySlug(a)?.name).join(", ")}</span>
                  <span>{typeBySlug(r.resource_type)?.name}</span>
                  <span>{r.page_count} page{r.page_count === 1 ? "" : "s"}</span>
                </div>
                {r.description && <p className="line-clamp-3 text-sm text-ink/80">{r.description}</p>}
                {(r.tags.length > 0 || r.curriculum_codes.length > 0) && (
                  <div className="flex flex-wrap gap-1">
                    {r.curriculum_codes.map((c) => <span key={c} className="chip font-mono">{c}</span>)}
                    {r.tags.map((t) => <span key={t} className="chip">#{t}</span>)}
                  </div>
                )}
                <div className="pt-2"><DecisionButtons id={r.id} /></div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
