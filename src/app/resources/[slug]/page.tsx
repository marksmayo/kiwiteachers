import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { after } from "next/server";
import { ChevronLeft, Download, FileText, Lock, Calendar, Layers } from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import { getRelated, getResourceBySlug, incrementViews } from "@/lib/resources";
import { areaBySlug, formatYears, typeBySlug, yearLabel } from "@/lib/taxonomy";
import { PdfPreview } from "@/components/pdf/PdfPreview";
import { FavouriteButton } from "@/components/FavouriteButton";
import { ResourceGrid } from "@/components/ResourceCard";

type Props = { params: Promise<{ slug: string }> };

export default function ResourcePage({ params }: Props) {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <Link href="/resources" className="inline-flex items-center gap-1 text-sm font-medium text-muted hover:text-fern">
        <ChevronLeft className="h-4 w-4" /> All resources
      </Link>
      <Suspense fallback={<DetailSkeleton />}>
        <Detail params={params} />
      </Suspense>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="mt-6 grid gap-10 lg:grid-cols-[1fr_380px]">
      <div className="aspect-[1/1.414] animate-pulse rounded-2xl bg-line/50" />
      <div className="space-y-3">
        <div className="h-8 w-3/4 animate-pulse rounded bg-line/60" />
        <div className="h-4 w-1/2 animate-pulse rounded bg-line/60" />
        <div className="h-24 animate-pulse rounded bg-line/40" />
      </div>
    </div>
  );
}

async function Detail({ params }: Props) {
  const { slug } = await params;
  const user = await getCurrentUser();
  const resource = await getResourceBySlug(slug, user?.id ?? null);
  if (!resource) notFound();
  after(() => incrementViews(resource.id));

  const related = await getRelated(resource, user?.id ?? null);
  const fileUrl = `/api/resources/${resource.id}/file`;
  const type = typeBySlug(resource.resource_type);
  const sizeKb = Math.max(1, Math.round(resource.file_size / 1024));

  return (
    <>
      <title>{`${resource.title} · KiwiTeachers`}</title>
      <meta name="description" content={resource.description.slice(0, 160)} />
      <div className="mt-6 grid gap-10 lg:grid-cols-[1fr_380px]">
        {/* Preview */}
        <div className="order-2 lg:order-1">
          {!user && (
            <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-kiwi/20 bg-[#f3ead9] p-4 sm:flex-row sm:items-center">
              <Lock className="h-5 w-5 shrink-0 text-kiwi" />
              <p className="flex-1 text-sm text-ink/80">
                You’re viewing a <strong>watermarked preview</strong>. Sign in free to view and download the clean copy.
              </p>
              <Link href={`/sign-in?next=/resources/${resource.slug}`} className="btn-primary shrink-0 py-2">
                Sign in free
              </Link>
            </div>
          )}
          <div className="rounded-2xl bg-[#ebe6d8] p-3 sm:p-6">
            <PdfPreview url={`${fileUrl}?v=${user ? "full" : "preview"}`} />
          </div>
        </div>

        {/* Details */}
        <aside className="order-1 lg:order-2 lg:sticky lg:top-24 lg:self-start">
          <div className="flex flex-wrap gap-2">
            {resource.learning_areas.map((slug) => {
              const a = areaBySlug(slug);
              return (
                <Link key={slug} href={`/resources?area=${slug}`} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold text-white" style={{ background: a?.color }}>
                  {a?.name}
                </Link>
              );
            })}
          </div>
          <h1 className="mt-4 text-3xl font-bold leading-tight sm:text-4xl">{resource.title}</h1>
          {resource.description && (
            <p className="mt-4 whitespace-pre-line leading-relaxed text-ink/80">{resource.description}</p>
          )}

          <div className="mt-6 flex flex-wrap gap-2">
            {user ? (
              <a href={`${fileUrl}?download=1`} className="btn-primary">
                <Download className="h-4 w-4" /> Download PDF
              </a>
            ) : (
              <Link href={`/sign-in?next=/resources/${resource.slug}`} className="btn-primary">
                <Download className="h-4 w-4" /> Sign in to download
              </Link>
            )}
            <FavouriteButton
              resourceId={resource.id}
              initial={!!resource.is_favourite}
              signedIn={!!user}
              variant="full"
              returnTo={`/resources/${resource.slug}`}
            />
          </div>

          <dl className="card mt-6 divide-y divide-line text-sm">
            <Row icon={<Calendar className="h-4 w-4" />} label="Year levels">
              <div className="flex flex-wrap justify-end gap-1">
                {resource.years.map((y) => (
                  <Link key={y} href={`/resources?year=${y}`} className="rounded-md bg-fern-light px-1.5 py-0.5 text-xs font-semibold text-fern hover:bg-fern hover:text-white" title={yearLabel(y)}>
                    {yearLabel(y, true)}
                  </Link>
                ))}
              </div>
            </Row>
            <Row icon={<Layers className="h-4 w-4" />} label="Type">
              <Link href={`/resources?type=${resource.resource_type}`} className="hover:text-fern">{type?.name}</Link>
            </Row>
            <Row icon={<FileText className="h-4 w-4" />} label="Length">
              {resource.page_count} {resource.page_count === 1 ? "page" : "pages"} · PDF · {sizeKb > 1024 ? `${(sizeKb / 1024).toFixed(1)} MB` : `${sizeKb} KB`}
            </Row>
          </dl>
          <p className="mt-2 text-xs text-muted">Suitable for {formatYears(resource.years)}.</p>

          {resource.tags.length > 0 && (
            <div className="mt-6">
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Keywords</h2>
              <div className="flex flex-wrap gap-1.5">
                {resource.tags.map((t) => (
                  <Link key={t} href={`/resources?tag=${encodeURIComponent(t)}`} className="chip">#{t}</Link>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>

      {related.length > 0 && (
        <section className="mt-20">
          <h2 className="mb-6 text-2xl font-bold">You might also like</h2>
          <ResourceGrid resources={related} signedIn={!!user} />
        </section>
      )}
    </>
  );
}

function Row({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <dt className="flex shrink-0 items-center gap-2 text-muted">{icon}{label}</dt>
      <dd className="text-right font-medium">{children}</dd>
    </div>
  );
}
