import Link from "next/link";
import type { Metadata } from "next";
import { Suspense } from "react";
import { Plus, Pencil } from "lucide-react";
import { requireUser } from "@/lib/require-user";
import { listByUploader, type ResourceStatus } from "@/lib/resources";
import { ResourceThumb } from "@/components/ResourceCard";
import { DeleteButton } from "@/components/admin/DeleteButton";
import { formatYears } from "@/lib/taxonomy";

export const metadata: Metadata = { title: "My contributions" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const BADGE: Record<ResourceStatus, { label: string; cls: string }> = {
  pending: { label: "Awaiting review", cls: "bg-amber-100 text-amber-800" },
  published: { label: "Live", cls: "bg-fern-light text-fern" },
  rejected: { label: "Not approved", cls: "bg-pohutukawa/10 text-pohutukawa" },
};

export default function MyResourcesPage({ searchParams }: Props) {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">My contributions</h1>
          <p className="text-muted">Resources you’ve shared, and where they’re up to.</p>
        </div>
        <Link href="/contribute" className="btn-primary"><Plus className="h-4 w-4" /> Share a resource</Link>
      </div>
      <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-line/40" />}>
        <List searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function List({ searchParams }: Props) {
  const [user, sp] = await Promise.all([requireUser("/my-resources"), searchParams]);
  const rows = await listByUploader(user.id);
  return (
    <>
      {sp.submitted && (
        <p className="mb-5 rounded-xl bg-fern-light px-4 py-3 text-sm text-fern" role="status">
          Ngā mihi! Your resource has been submitted and will go live once it’s been checked.
        </p>
      )}
      {rows.length === 0 ? (
        <div className="card px-6 py-14 text-center">
          <p className="font-display text-xl font-semibold">You haven’t shared anything yet</p>
          <p className="mt-2 text-sm text-muted">Got a worksheet that went down a treat? Share it with other teachers.</p>
          <Link href="/contribute" className="btn-primary mt-5">Share a resource</Link>
        </div>
      ) : (
        <ul className="card divide-y divide-line overflow-hidden">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center gap-4 p-3 sm:p-4">
              <div className="hidden h-14 w-20 shrink-0 overflow-hidden rounded-lg border border-line bg-white sm:block">
                <ResourceThumb resource={r} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/resources/${r.slug}`} className="truncate font-semibold hover:text-fern">{r.title}</Link>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${BADGE[r.status].cls}`}>{BADGE[r.status].label}</span>
                </div>
                <div className="mt-0.5 text-xs text-muted">
                  {formatYears(r.years)} · {r.status === "published" ? `${r.view_count} views · ${r.download_count} downloads` : `submitted ${new Date(r.created_at).toLocaleDateString("en-NZ")}`}
                </div>
                {r.status === "rejected" && r.rejection_reason && (
                  <p className="mt-1 text-xs text-pohutukawa">Reason: {r.rejection_reason}</p>
                )}
              </div>
              {r.status !== "published" && (
                <>
                  <Link href={`/contribute/${r.id}/edit`} className="rounded-full p-2 text-muted hover:bg-fern-light hover:text-fern" aria-label={`Edit ${r.title}`}>
                    <Pencil className="h-4 w-4" />
                  </Link>
                  <DeleteButton id={r.id} label="Withdraw" />
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
