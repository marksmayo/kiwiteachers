import Link from "next/link";
import type { Metadata } from "next";
import { Suspense } from "react";
import { X } from "lucide-react";
import { Filters, SortSelect } from "@/components/Filters";
import { GridSkeleton, ResourceGrid } from "@/components/ResourceCard";
import { searchResources, type SearchParams } from "@/lib/resources";
import { getCurrentUser } from "@/lib/session";
import { areaBySlug, typeBySlug, yearLabel } from "@/lib/taxonomy";

export const metadata: Metadata = { title: "Browse resources" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

function normalise(sp: Record<string, string | string[] | undefined>): SearchParams {
  const one = (k: string) => {
    const v = sp[k];
    return (Array.isArray(v) ? v[0] : v) || undefined;
  };
  return { q: one("q"), year: one("year"), area: one("area"), type: one("type"), tag: one("tag"), rating: one("rating"), sort: one("sort"), page: one("page") };
}

export default function ResourcesPage({ searchParams }: Props) {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold sm:text-4xl">Ngā rauemi · Resources</h1>
        <p className="mt-1 text-muted">Filter by year level, learning area and type — or search for a topic.</p>
      </div>
      <Suspense fallback={<Layout sidebar={<div className="h-96 animate-pulse rounded-2xl bg-line/40" />} main={<GridSkeleton count={9} />} />}>
        <Results searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

function Layout({ sidebar, main }: { sidebar: React.ReactNode; main: React.ReactNode }) {
  return (
    <div className="grid gap-8 lg:grid-cols-[260px_1fr]">
      <div className="lg:sticky lg:top-24 lg:self-start">{sidebar}</div>
      <div>{main}</div>
    </div>
  );
}

async function Results({ searchParams }: Props) {
  const params = normalise(await searchParams);
  const user = await getCurrentUser();
  const { rows, total, page, pageCount } = await searchResources(params, user?.id ?? null);

  const activeChips: { label: string; remove: Partial<SearchParams> }[] = [];
  if (params.q) activeChips.push({ label: `“${params.q}”`, remove: { q: undefined } });
  if (params.year) activeChips.push({ label: yearLabel(Number(params.year)), remove: { year: undefined } });
  if (params.area) activeChips.push({ label: areaBySlug(params.area)?.name ?? params.area, remove: { area: undefined } });
  if (params.type) activeChips.push({ label: typeBySlug(params.type)?.name ?? params.type, remove: { type: undefined } });
  if (params.rating) activeChips.push({ label: `${params.rating}★ & up`, remove: { rating: undefined } });
  if (params.tag) activeChips.push({ label: `#${params.tag}`, remove: { tag: undefined } });

  const href = (patch: Partial<SearchParams>) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...params, ...patch })) if (v) qs.set(k, v);
    return `/resources${qs.size ? `?${qs}` : ""}`;
  };

  return (
    <Layout
      sidebar={<Filters params={params} />}
      main={
        <>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-muted">
                {total} resource{total === 1 ? "" : "s"}
              </span>
              {activeChips.map((c) => (
                <Link key={c.label} href={href({ ...c.remove, page: undefined })} className="chip bg-fern-light text-fern">
                  {c.label} <X className="h-3 w-3" />
                </Link>
              ))}
            </div>
            <SortSelect params={params} />
          </div>

          {rows.length ? (
            <ResourceGrid resources={rows} signedIn={!!user} />
          ) : (
            <div className="card flex flex-col items-center px-6 py-16 text-center">
              <p className="font-display text-xl font-semibold">Aue! Nothing matched.</p>
              <p className="mt-2 max-w-sm text-sm text-muted">Try a broader search, or remove a filter or two.</p>
              <Link href="/resources" className="btn-ghost mt-5">Clear filters</Link>
            </div>
          )}

          {pageCount > 1 && (
            <nav className="mt-10 flex items-center justify-center gap-2" aria-label="Pagination">
              {page > 1 && <Link href={href({ page: String(page - 1) })} className="btn-ghost">← Previous</Link>}
              <span className="px-3 text-sm text-muted">Page {page} of {pageCount}</span>
              {page < pageCount && <Link href={href({ page: String(page + 1) })} className="btn-ghost">Next →</Link>}
            </nav>
          )}
        </>
      }
    />
  );
}
