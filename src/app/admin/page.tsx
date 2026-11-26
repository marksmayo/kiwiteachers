import Link from "next/link";
import type { Metadata } from "next";
import { Suspense } from "react";
import { forbidden, redirect } from "next/navigation";
import { Pencil, Plus, Eye, Heart, Download, Star } from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import { getStats, listAllResources } from "@/lib/resources";
import { areaBySlug, formatYears, typeBySlug } from "@/lib/taxonomy";
import { DeleteButton } from "@/components/admin/DeleteButton";
import { ResourceThumb } from "@/components/ResourceCard";

export const metadata: Metadata = { title: "Manage resources" };

export default function AdminPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Manage resources</h1>
          <p className="text-muted">Upload, edit and remove resources.</p>
        </div>
        <Link href="/admin/new" className="btn-primary"><Plus className="h-4 w-4" /> Upload resource</Link>
      </div>
      <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-line/40" />}>
        <AdminList />
      </Suspense>
    </div>
  );
}

async function AdminList() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in?next=/admin");
  if (!user.isAdmin) forbidden();
  const [rows, stats] = await Promise.all([listAllResources(), getStats()]);

  return (
    <>
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Resources" value={stats.resources} />
        <Stat label="Registered teachers" value={stats.users} />
        <Stat label="Total views" value={rows.reduce((s, r) => s + r.view_count, 0)} />
        <Stat label="Total downloads" value={rows.reduce((s, r) => s + r.download_count, 0)} />
      </div>
      {rows.length === 0 ? (
        <div className="card px-6 py-14 text-center text-muted">No resources yet. Upload your first one!</div>
      ) : (
        <div className="card divide-y divide-line overflow-hidden">
          {rows.map((r) => (
            <div key={r.id} className="flex items-center gap-4 p-3 sm:p-4">
              <div className="hidden h-14 w-20 shrink-0 overflow-hidden rounded-lg border border-line bg-white sm:block">
                <ResourceThumb resource={r} />
              </div>
              <div className="min-w-0 flex-1">
                <Link href={`/resources/${r.slug}`} className="block truncate font-semibold hover:text-fern">{r.title}</Link>
                <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-muted">
                  <span>{formatYears(r.years)}</span>
                  <span>{r.learning_areas.map((a) => areaBySlug(a)?.name).join(", ")}</span>
                  <span>{typeBySlug(r.resource_type)?.name}</span>
                  <span>{r.page_count}p</span>
                </div>
              </div>
              <div className="hidden items-center gap-3 text-xs text-muted md:flex">
                <span className="flex items-center gap-1"><Eye className="h-3.5 w-3.5" />{r.view_count}</span>
                <span className="flex items-center gap-1"><Download className="h-3.5 w-3.5" />{r.download_count}</span>
                <span className="flex items-center gap-1"><Heart className="h-3.5 w-3.5" />{r.favourite_count}</span>
                <span className="flex items-center gap-1"><Star className="h-3.5 w-3.5" />{r.rating_count ? `${r.rating_avg?.toFixed(1)} (${r.rating_count})` : "–"}</span>
              </div>
              <Link href={`/admin/${r.id}/edit`} className="rounded-full p-2 text-muted hover:bg-fern-light hover:text-fern" aria-label="Edit">
                <Pencil className="h-4 w-4" />
              </Link>
              <DeleteButton id={r.id} />
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="card p-4">
      <div className="font-display text-3xl font-bold text-fern">{value}</div>
      <div className="text-sm text-muted">{label}</div>
    </div>
  );
}
