"use client";

import { useEffect, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";

pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();

export default function PdfViewer({ url }: { url: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [numPages, setNumPages] = useState(0);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={ref} className="w-full" onContextMenu={(e) => e.preventDefault()}>
      {error ? (
        <div className="flex aspect-[1/1.414] items-center justify-center rounded-xl bg-paper text-sm text-muted">
          Couldn’t load the preview. <a className="ml-1 text-fern underline" href={url} target="_blank" rel="noreferrer">Open it directly</a>
        </div>
      ) : (
        <Document
          file={url}
          onLoadSuccess={({ numPages }) => setNumPages(numPages)}
          onLoadError={() => setError(true)}
          loading={<PageSkeleton />}
          className="flex flex-col gap-5"
        >
          {width > 0 &&
            Array.from({ length: numPages }, (_, i) => (
              <div key={i} className="overflow-hidden rounded-lg bg-white shadow-[0_6px_24px_-8px_rgba(23,37,30,0.25)] ring-1 ring-line">
                <Page
                  pageNumber={i + 1}
                  width={width}
                  renderTextLayer={false}
                  renderAnnotationLayer={false}
                  loading={<PageSkeleton />}
                />
              </div>
            ))}
        </Document>
      )}
    </div>
  );
}

function PageSkeleton() {
  return <div className="aspect-[1/1.414] w-full animate-pulse rounded-lg bg-line/50" />;
}

/** Renders page 1 of a PDF file to a small watermarked WebP for card thumbnails. */
export async function renderThumbnail(file: File): Promise<Blob | null> {
  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjs.getDocument({ data }).promise;
  const page = await doc.getPage(1);
  const base = page.getViewport({ scale: 1 });
  const scale = 640 / base.width;
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.width * 0.75); // 4:3 crop of the top of the page
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvas, canvasContext: ctx, viewport }).promise;

  // light watermark so thumbnails aren't a usable copy
  ctx.save();
  ctx.globalAlpha = 0.12;
  ctx.fillStyle = "#1f5c3f";
  ctx.font = "bold 28px sans-serif";
  ctx.rotate((-28 * Math.PI) / 180);
  for (let y = 0; y < canvas.height * 2; y += 110) {
    for (let x = -canvas.width; x < canvas.width * 2; x += 330) {
      ctx.fillText("KiwiTeachers · PREVIEW", x, y);
    }
  }
  ctx.restore();
  await doc.cleanup?.();
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/webp", 0.82));
}
