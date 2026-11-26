import Link from "next/link";
import { FileText } from "lucide-react";
import type { Resource } from "@/lib/resources";
import { areaBySlug, formatYears, typeBySlug } from "@/lib/taxonomy";
import { FavouriteButton } from "./FavouriteButton";

export function ResourceThumb({ resource, className = "" }: { resource: Resource; className?: string }) {
  const area = areaBySlug(resource.learning_areas[0]);
  if (resource.thumb_pathname) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={`/api/resources/${resource.id}/thumb`}
        alt=""
        loading="lazy"
        className={`h-full w-full object-cover object-top ${className}`}
      />
    );
  }
  return (
    <div
      className={`fern-pattern flex h-full w-full flex-col items-center justify-center gap-2 ${className}`}
      style={{ backgroundColor: `${area?.color ?? "#1f5c3f"}14` }}
    >
      <FileText className="h-10 w-10" style={{ color: area?.color }} strokeWidth={1.5} />
      <span className="text-xs font-medium text-muted">{typeBySlug(resource.resource_type)?.name}</span>
    </div>
  );
}

export function ResourceCard({ resource, signedIn }: { resource: Resource; signedIn: boolean }) {
  const area = areaBySlug(resource.learning_areas[0]);
  return (
    <Link
      href={`/resources/${resource.slug}`}
      className="card group flex flex-col overflow-hidden transition hover:-translate-y-0.5 hover:border-fern/30 hover:shadow-lg"
    >
      <div className="relative aspect-[4/3] overflow-hidden border-b border-line bg-white">
        <ResourceThumb resource={resource} className="transition duration-300 group-hover:scale-[1.03]" />
        <div className="absolute right-2.5 top-2.5">
          <FavouriteButton
            resourceId={resource.id}
            initial={!!resource.is_favourite}
            signedIn={signedIn}
            returnTo={`/resources/${resource.slug}`}
          />
        </div>
        <span className="absolute bottom-2.5 left-2.5 rounded-full bg-ink/75 px-2.5 py-0.5 text-[11px] font-medium text-white backdrop-blur">
          {resource.page_count} {resource.page_count === 1 ? "page" : "pages"}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-center gap-2 text-xs font-medium">
          <span className="h-2 w-2 rounded-full" style={{ background: area?.color }} />
          <span className="text-muted">{area?.name}</span>
        </div>
        <h3 className="line-clamp-2 font-display text-[17px] font-semibold leading-snug text-ink group-hover:text-fern">
          {resource.title}
        </h3>
        <div className="mt-auto flex flex-wrap gap-1.5 pt-1">
          <span className="rounded-md bg-fern-light px-2 py-0.5 text-[11px] font-semibold text-fern">
            {formatYears(resource.years)}
          </span>
          <span className="rounded-md bg-sand px-2 py-0.5 text-[11px] font-medium text-ink/70">
            {typeBySlug(resource.resource_type)?.name}
          </span>
        </div>
      </div>
    </Link>
  );
}

export function ResourceGrid({ resources, signedIn }: { resources: Resource[]; signedIn: boolean }) {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {resources.map((r) => (
        <ResourceCard key={r.id} resource={r} signedIn={signedIn} />
      ))}
    </div>
  );
}

export function GridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card overflow-hidden">
          <div className="aspect-[4/3] animate-pulse bg-line/50" />
          <div className="space-y-2 p-4">
            <div className="h-3 w-1/3 animate-pulse rounded bg-line/60" />
            <div className="h-4 w-4/5 animate-pulse rounded bg-line/60" />
            <div className="h-4 w-1/2 animate-pulse rounded bg-line/60" />
          </div>
        </div>
      ))}
    </div>
  );
}
