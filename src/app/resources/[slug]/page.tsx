import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ChevronLeft, Download, FileText, Lock, Calendar, Layers, Eye, Hourglass, BookMarked, UserRound } from "lucide-react";
import { getCurrentUser } from "@/lib/session";
import { getRelated, getResourceBySlug } from "@/lib/resources";
import { getQuota } from "@/lib/downloads";
import { areaBySlug, formatYears, typeBySlug, yearLabel } from "@/lib/taxonomy";
import { PdfPreview } from "@/components/pdf/PdfPreview";
import { PreviewImages } from "@/components/pdf/PreviewImages";
import { FavouriteButton } from "@/components/FavouriteButton";
import { ResourceGrid } from "@/components/ResourceCard";
import { RatingInput } from "@/components/RatingInput";
import { ViewTracker } from "@/components/ViewTracker";
import { Reviews, displayName } from "@/components/reviews/Reviews";
import { DecisionButtons } from "@/components/admin/DecisionButtons";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default function ResourcePage(props: Props) {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <Link href="/resources" className="inline-flex items-center gap-1 text-sm font-medium text-muted hover:text-fern">
        <ChevronLeft className="h-4 w-4" /> All resources
      </Link>
      <Suspense fallback={<DetailSkeleton />}>
        <Detail {...props} />
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

async function Detail({ params, searchParams }: Props) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const user = await getCurrentUser();
  const resource = await getResourceBySlug(slug, user);
  if (!resource) notFound();

  const published = resource.status === "published";
  const isOwner = !!user && resource.uploaded_by === user.id;
  const privileged = !!user && (user.isAdmin || isOwner);
  const [related, quota] = await Promise.all([
    published ? getRelated(resource, user?.id ?? null) : Promise.resolve([]),
    user ? getQuota(user) : Promise.resolve(null),
  ]);

  const fileUrl = `/api/resources/${resource.id}/file`;
  const type = typeBySlug(resource.resource_type);
  const sizeKb = Math.max(1, Math.round(resource.file_size / 1024));
  const downloadedToday = !!quota?.resourceIds.includes(resource.id);
  const outOfDownloads = !!quota && !quota.unlimited && quota.remaining <= 0 && !downloadedToday && !privileged;
  const limitHit = (sp.limit === "reached" && !downloadedToday) || outOfDownloads;

  return (
    <>
      {published && <ViewTracker id={resource.id} />}
      <title>{`${resource.title} · KiwiTeachers`}</title>
      <meta name="description" content={resource.description.slice(0, 160)} />

      {!published && (
        <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 sm:flex-row sm:items-center">
          <Hourglass className="h-5 w-5 shrink-0 text-amber-700" />
          <div className="flex-1 text-sm text-amber-900">
            {resource.status === "pending" ? (
              <><strong>Awaiting review.</strong> Only the contributor and site admins can see this.</>
            ) : (
              <><strong>Not approved:</strong> {resource.rejection_reason}</>
            )}
          </div>
          {user?.isAdmin && resource.status === "pending" && <DecisionButtons id={resource.id} />}
          {isOwner && !user?.isAdmin && (
            <Link href={`/contribute/${resource.id}/edit`} className="btn-ghost py-1.5">Edit submission</Link>
          )}
        </div>
      )}

      <div className="mt-6 grid gap-10 lg:grid-cols-[1fr_380px]">
        <div className="order-2 lg:order-1">
          {!privileged && (
            <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-kiwi/20 bg-[#f3ead9] p-4 sm:flex-row sm:items-center">
              <Lock className="h-5 w-5 shrink-0 text-kiwi" />
              <p className="flex-1 text-sm text-ink/80">
                You’re viewing a <strong>watermarked preview</strong>.{" "}
                {user ? "Download to get the clean copy." : "Sign in free to download the clean copy."}
              </p>
              {!user && (
                <Link href={`/sign-in?next=/resources/${resource.slug}`} className="btn-primary shrink-0 py-2">Sign in free</Link>
              )}
            </div>
          )}
          <div className="rounded-2xl bg-[#ebe6d8] p-3 sm:p-6">
            {!privileged && resource.preview_pathnames.length > 0 ? (
              <PreviewImages resourceId={resource.id} pages={resource.preview_pathnames.length} title={resource.title} />
            ) : (
              <PdfPreview url={`${fileUrl}?v=${privileged ? "full" : user ? "member" : "preview"}`} />
            )}
          </div>
        </div>

        <aside className="order-1 lg:order-2 lg:sticky lg:top-24 lg:self-start">
          <div className="flex flex-wrap gap-2">
            {resource.learning_areas.map((a) => {
              const area = areaBySlug(a);
              return (
                <Link key={a} href={`/resources?area=${a}`} className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold text-white" style={{ background: area?.color }}>
                  {area?.name}
                </Link>
              );
            })}
          </div>
          <h1 className="mt-4 text-3xl font-bold leading-tight sm:text-4xl">{resource.title}</h1>
          {resource.uploader_name && (
            <p className="mt-2 flex items-center gap-1.5 text-sm text-muted">
              <UserRound className="h-4 w-4" /> Shared by {displayName(resource.uploader_name)}
            </p>
          )}
          {resource.description && <p className="mt-4 whitespace-pre-line leading-relaxed text-ink/80">{resource.description}</p>}

          <div className="mt-6 flex flex-wrap gap-2">
            {!user ? (
              <Link href={`/sign-in?next=/resources/${resource.slug}`} className="btn-primary">
                <Download className="h-4 w-4" /> Sign in to download
              </Link>
            ) : limitHit ? (
              <span className="btn cursor-not-allowed bg-line text-muted" aria-disabled="true">
                <Download className="h-4 w-4" /> Daily limit reached
              </span>
            ) : (
              <a href={`${fileUrl}?download=1`} className="btn-primary">
                <Download className="h-4 w-4" /> Download PDF
              </a>
            )}
            {published && (
              <FavouriteButton resourceId={resource.id} initial={!!resource.is_favourite} signedIn={!!user} variant="full" returnTo={`/resources/${resource.slug}`} />
            )}
          </div>
          {quota && !quota.unlimited && (
            <p className={`mt-2 text-xs ${limitHit ? "text-pohutukawa" : "text-muted"}`} role="status">
              {limitHit
                ? `You’ve used all ${quota.limit} downloads for today. Your allowance resets at midnight (NZ time).`
                : downloadedToday
                  ? `You’ve downloaded this today, so downloading it again is free. ${quota.remaining} of ${quota.limit} left today.`
                  : `${quota.remaining} of ${quota.limit} free downloads left today.`}
            </p>
          )}

          {published && (
            <div className="mt-6">
              <RatingInput
                resourceId={resource.id}
                initialAvg={resource.rating_avg}
                initialCount={resource.rating_count}
                initialMine={resource.my_rating ?? null}
                signedIn={!!user}
                returnTo={`/resources/${resource.slug}`}
              />
            </div>
          )}

          <dl className="card mt-4 divide-y divide-line text-sm">
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
            <Row icon={<Eye className="h-4 w-4" />} label="Views">{resource.view_count.toLocaleString("en-NZ")}</Row>
            <Row icon={<Download className="h-4 w-4" />} label="Downloads">{resource.download_count.toLocaleString("en-NZ")}</Row>
          </dl>
          <p className="mt-2 text-xs text-muted">Suitable for {formatYears(resource.years)}.</p>

          {resource.curriculum_codes.length > 0 && (
            <div className="mt-6">
              <h2 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted">
                <BookMarked className="h-3.5 w-3.5" /> Te Mātaiaho codes
              </h2>
              <div className="flex flex-wrap gap-1.5">
                {resource.curriculum_codes.map((c) => (
                  <Link key={c} href={`/resources?code=${encodeURIComponent(c)}`} className="chip font-mono">{c}</Link>
                ))}
              </div>
            </div>
          )}

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

      {published && (
        <Reviews resourceId={resource.id} slug={resource.slug} viewerId={user?.id ?? null} myScore={resource.my_rating ?? null} />
      )}

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
