"use client";

import dynamic from "next/dynamic";

const PdfViewer = dynamic(() => import("./PdfViewer"), {
  ssr: false,
  loading: () => <div className="aspect-[1/1.414] w-full animate-pulse rounded-lg bg-line/50" />,
});

export function PdfPreview({ url }: { url: string }) {
  return <PdfViewer url={url} />;
}
