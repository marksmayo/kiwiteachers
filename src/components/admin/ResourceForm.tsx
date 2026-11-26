"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { upload } from "@vercel/blob/client";
import { FileUp, Loader2, X, CheckCircle2 } from "lucide-react";
import { saveResource } from "@/app/actions";
import { LEARNING_AREAS, RESOURCE_TYPES, YEARS, yearLabel } from "@/lib/taxonomy";

export type ResourceFormInitial = {
  id: string;
  title: string;
  description: string;
  years: number[];
  learningAreas: string[];
  resourceType: string;
  tags: string[];
};

export function ResourceForm({ initial }: { initial?: ResourceFormInitial }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [years, setYears] = useState<number[]>(initial?.years ?? []);
  const [areas, setAreas] = useState<string[]>(initial?.learningAreas ?? []);
  const [type, setType] = useState(initial?.resourceType ?? "");
  const [tags, setTags] = useState<string[]>(initial?.tags ?? []);
  const [tagDraft, setTagDraft] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const pickFile = (f: File | undefined | null) => {
    if (!f) return;
    if (f.type !== "application/pdf" && !f.name.toLowerCase().endsWith(".pdf")) {
      setError("Please choose a PDF file. (Export Word/Google Docs as PDF first.)");
      return;
    }
    setError(null);
    setFile(f);
    if (!title) setTitle(f.name.replace(/\.pdf$/i, "").replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim());
  };

  const addTags = (raw: string) => {
    const parts = raw.split(/[,\n]/).map((t) => t.trim().toLowerCase()).filter(Boolean);
    if (parts.length) setTags((prev) => [...new Set([...prev, ...parts])].slice(0, 20));
    setTagDraft("");
  };

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!initial && !file) return setError("Please attach a PDF.");
    if (!years.length) return setError("Choose at least one year level.");
    if (!areas.length) return setError("Choose at least one learning area.");
    if (!type) return setError("Choose a resource type.");

    setBusy(true);
    try {
      let blobPathname: string | undefined;
      let thumbPathname: string | null = null;
      if (file) {
        setStatus("Creating thumbnail…");
        try {
          const { renderThumbnail } = await import("@/components/pdf/PdfViewer");
          const thumb = await renderThumbnail(file);
          if (thumb) {
            const t = await upload("thumbs/thumb.webp", thumb, { access: "private", handleUploadUrl: "/api/upload", contentType: "image/webp" });
            thumbPathname = t.pathname;
          }
        } catch (err) {
          console.warn("Thumbnail failed", err);
        }
        setStatus("Uploading PDF…");
        const safeName = file.name.toLowerCase().replace(/[^a-z0-9.]+/g, "-");
        const res = await upload(`docs/${safeName}`, file, {
          access: "private",
          handleUploadUrl: "/api/upload",
          contentType: "application/pdf",
          onUploadProgress: ({ percentage }) => setStatus(`Uploading PDF… ${Math.round(percentage)}%`),
        });
        blobPathname = res.pathname;
      }
      setStatus("Saving…");
      const allTags = tagDraft.trim() ? [...tags, ...tagDraft.split(",").map((t) => t.trim().toLowerCase())] : tags;
      const result = await saveResource({
        id: initial?.id,
        title,
        description,
        years,
        learningAreas: areas,
        resourceType: type,
        tags: allTags,
        blobPathname,
        thumbPathname,
      });
      if (!result.ok) throw new Error(result.error);
      setStatus("Saved!");
      router.push(`/resources/${result.slug}`);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setStatus(null);
      setBusy(false);
    }
  }

  const label = "mb-2 block text-sm font-semibold";

  return (
    <form onSubmit={onSubmit} className="space-y-8">
      {/* File */}
      <div>
        <span className={label}>PDF file {initial && <span className="font-normal text-muted">(optional — leave empty to keep the current file)</span>}</span>
        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); pickFile(e.dataTransfer.files[0]); }}
          className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-10 text-center transition ${dragOver ? "border-fern bg-fern-light" : "border-line bg-paper hover:border-fern/50"}`}
        >
          {file ? (
            <>
              <CheckCircle2 className="h-8 w-8 text-fern" />
              <p className="mt-2 font-semibold">{file.name}</p>
              <p className="text-xs text-muted">{(file.size / 1024).toFixed(0)} KB · click to change</p>
            </>
          ) : (
            <>
              <FileUp className="h-8 w-8 text-fern" />
              <p className="mt-2 font-semibold">Drop a PDF here, or click to choose</p>
              <p className="text-xs text-muted">1–4 page documents work best · max 25 MB</p>
            </>
          )}
          <input ref={inputRef} type="file" accept="application/pdf,.pdf" className="hidden" onChange={(e) => pickFile(e.target.files?.[0])} />
        </div>
      </div>

      <div className="grid gap-5">
        <label className="block">
          <span className={label}>Title</span>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={160} placeholder="e.g. Matariki star fractions" />
        </label>
        <label className="block">
          <span className={label}>Description</span>
          <textarea className="input min-h-28" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={4000} placeholder="What's in it, how to use it, curriculum links…" />
        </label>
      </div>

      <div>
        <span className={label}>Year levels</span>
        <div className="flex flex-wrap gap-1.5">
          {YEARS.map((y) => (
            <button type="button" key={y} onClick={() => setYears(toggle(years, y))} title={yearLabel(y)} aria-pressed={years.includes(y)}
              className={`min-w-11 rounded-lg border px-2.5 py-1.5 text-sm font-medium transition ${years.includes(y) ? "border-fern bg-fern text-white" : "border-line bg-paper hover:border-fern/40"}`}>
              {y === 0 ? "NE" : y}
            </button>
          ))}
        </div>
        <div className="mt-2 flex gap-3 text-xs">
          {[["Junior (NE–3)", [0, 1, 2, 3]], ["Middle (4–6)", [4, 5, 6]], ["Intermediate (7–8)", [7, 8]], ["Secondary (9–13)", [9, 10, 11, 12, 13]]].map(([l, ys]) => (
            <button key={l as string} type="button" className="text-fern hover:underline" onClick={() => setYears([...new Set([...years, ...(ys as number[])])])}>
              + {l as string}
            </button>
          ))}
        </div>
      </div>

      <div>
        <span className={label}>Learning areas</span>
        <div className="flex flex-wrap gap-1.5">
          {LEARNING_AREAS.map((a) => {
            const on = areas.includes(a.slug);
            return (
              <button type="button" key={a.slug} onClick={() => setAreas(toggle(areas, a.slug))} aria-pressed={on}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition ${on ? "border-transparent text-white" : "border-line bg-paper hover:border-fern/40"}`}
                style={on ? { background: a.color } : undefined}>
                {!on && <span className="h-2 w-2 rounded-full" style={{ background: a.color }} />}
                {a.name}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <span className={label}>Resource type</span>
        <div className="flex flex-wrap gap-1.5">
          {RESOURCE_TYPES.map((t) => (
            <button type="button" key={t.slug} onClick={() => setType(t.slug)} aria-pressed={type === t.slug}
              className={`rounded-full border px-3 py-1.5 text-sm transition ${type === t.slug ? "border-fern bg-fern text-white" : "border-line bg-paper hover:border-fern/40"}`}>
              {t.name}
            </button>
          ))}
        </div>
      </div>

      <div>
        <span className={label}>Keywords / tags</span>
        <div className="input flex min-h-12 flex-wrap items-center gap-1.5 py-2">
          {tags.map((t) => (
            <span key={t} className="inline-flex items-center gap-1 rounded-full bg-fern-light px-2.5 py-0.5 text-xs font-medium text-fern">
              #{t}
              <button type="button" onClick={() => setTags(tags.filter((x) => x !== t))} aria-label={`Remove ${t}`}><X className="h-3 w-3" /></button>
            </span>
          ))}
          <input
            value={tagDraft}
            onChange={(e) => (e.target.value.includes(",") ? addTags(e.target.value) : setTagDraft(e.target.value))}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); addTags(tagDraft); }
              if (e.key === "Backspace" && !tagDraft && tags.length) setTags(tags.slice(0, -1));
            }}
            onBlur={() => addTags(tagDraft)}
            className="min-w-40 flex-1 bg-transparent outline-none"
            placeholder={tags.length ? "" : "fractions, matariki, reading comprehension…"}
          />
        </div>
        <p className="mt-1 text-xs text-muted">Press Enter or comma to add. These power search.</p>
      </div>

      {error && <p className="rounded-xl bg-pohutukawa/10 px-4 py-3 text-sm text-pohutukawa" role="alert">{error}</p>}

      <div className="flex items-center gap-4">
        <button disabled={busy} className="btn-primary px-8 py-3">
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          {initial ? "Save changes" : "Publish resource"}
        </button>
        {status && <span className="text-sm text-muted">{status}</span>}
      </div>
    </form>
  );
}
