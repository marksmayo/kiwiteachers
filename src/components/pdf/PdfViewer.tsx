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

type Source = File | ArrayBuffer;

async function openDoc(source: Source) {
  const data = new Uint8Array(source instanceof ArrayBuffer ? source : await source.arrayBuffer());
  return pdfjs.getDocument({ data }).promise;
}

function toWebp(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob((b) => resolve(b), "image/webp", quality));
}

/** Tiled diagonal watermark baked into the pixels, so it can't be stripped like a PDF layer. */
function stampWatermark(ctx: CanvasRenderingContext2D, w: number, h: number, alpha: number, fontPx: number) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = "#1f5c3f";
  ctx.font = `bold ${fontPx}px sans-serif`;
  ctx.rotate((-28 * Math.PI) / 180);
  const stepX = fontPx * 12;
  const stepY = fontPx * 4;
  for (let y = 0; y < h * 2; y += stepY) {
    for (let x = -w; x < w * 2; x += stepX) ctx.fillText("KiwiTeachers · PREVIEW", x + ((y / stepY) % 2) * (stepX / 2), y);
  }
  ctx.restore();
}

async function renderPage(doc: Awaited<ReturnType<typeof openDoc>>, n: number, width: number, cropRatio?: number) {
  const page = await doc.getPage(n);
  const viewport = page.getViewport({ scale: width / page.getViewport({ scale: 1 }).width });
  const canvas = document.createElement("canvas");
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(cropRatio ? viewport.width * cropRatio : viewport.height);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvas, canvasContext: ctx, viewport }).promise;
  return { canvas, ctx };
}

/** Renders page 1 to a small watermarked WebP for card thumbnails. */
export async function renderThumbnail(source: Source): Promise<Blob | null> {
  const doc = await openDoc(source);
  const { canvas, ctx } = await renderPage(doc, 1, 640, 0.75);
  stampWatermark(ctx, canvas.width, canvas.height, 0.12, 28);
  await doc.cleanup?.();
  return toWebp(canvas, 0.82);
}

/** Renders every page to a watermarked WebP. These images are the public preview. */
export async function renderPreviews(source: Source, width = 1000): Promise<Blob[]> {
  const doc = await openDoc(source);
  const out: Blob[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const { canvas, ctx } = await renderPage(doc, n, width);
    stampWatermark(ctx, canvas.width, canvas.height, 0.17, Math.round(width / 26));
    // footer banner
    const bh = Math.round(width / 30);
    ctx.fillStyle = "rgba(31,92,63,0.92)";
    ctx.fillRect(0, canvas.height - bh, canvas.width, bh);
    ctx.fillStyle = "#ffffff";
    ctx.font = `bold ${Math.round(bh * 0.45)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("Preview only — download the clean copy free at KiwiTeachers", canvas.width / 2, canvas.height - bh * 0.35);
    const blob = await toWebp(canvas, 0.72);
    if (!blob) throw new Error("Couldn't create preview images");
    out.push(blob);
  }
  await doc.cleanup?.();
  return out;
}
