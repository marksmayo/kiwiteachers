/** Watermarked page images: what visitors and members see before downloading. */
export function PreviewImages({ resourceId, pages, title }: { resourceId: string; pages: number; title: string }) {
  return (
    <div className="flex flex-col gap-5">
      {Array.from({ length: pages }, (_, i) => (
        <div key={i} className="overflow-hidden rounded-lg bg-white shadow-[0_6px_24px_-8px_rgba(23,37,30,0.25)] ring-1 ring-line">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/resources/${resourceId}/preview/${i + 1}`}
            alt={`${title}: page ${i + 1} preview`}
            loading={i === 0 ? "eager" : "lazy"}
            draggable={false}
            className="block h-auto w-full select-none"
          />
        </div>
      ))}
    </div>
  );
}
