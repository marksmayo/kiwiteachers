"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Search, X, Star } from "lucide-react";
import { LEARNING_AREAS, RESOURCE_TYPES, YEARS, yearLabel } from "@/lib/taxonomy";
import type { SearchParams } from "@/lib/resources";

export function Filters({ params }: { params: SearchParams }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const go = (next: Partial<SearchParams>) => {
    const merged: Record<string, string | undefined> = { ...params, ...next, page: undefined };
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(merged)) if (v) qs.set(k, v);
    start(() => router.push(`/resources${qs.size ? `?${qs}` : ""}`, { scroll: false }));
  };

  const active = !!(params.q || params.year || params.area || params.type || params.tag || params.rating || params.code);
  const pill = (on: boolean) =>
    `rounded-lg px-2.5 py-1.5 text-left text-sm transition ${on ? "bg-fern text-white font-semibold" : "text-ink/80 hover:bg-fern-light hover:text-fern"}`;

  return (
    <aside className={`space-y-6 transition-opacity ${pending ? "opacity-60" : ""}`} aria-busy={pending}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const q = new FormData(e.currentTarget).get("q")?.toString().trim();
          go({ q: q || undefined, sort: q ? "relevance" : params.sort });
        }}
        className="relative"
      >
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <input key={params.q ?? ""} name="q" defaultValue={params.q} placeholder="Search…" className="input pl-10" aria-label="Search" />
      </form>

      {active && (
        <button onClick={() => start(() => router.push("/resources"))} className="flex items-center gap-1 text-sm font-medium text-pohutukawa hover:underline">
          <X className="h-4 w-4" /> Clear all filters
        </button>
      )}

      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Year level</h3>
        <div className="grid grid-cols-4 gap-1.5 lg:grid-cols-4">
          {YEARS.map((y) => {
            const on = params.year === String(y);
            return (
              <button
                key={y}
                onClick={() => go({ year: on ? undefined : String(y) })}
                className={`rounded-lg border py-1.5 text-sm font-medium transition ${on ? "border-fern bg-fern text-white" : "border-line bg-paper hover:border-fern/40 hover:text-fern"}`}
                title={yearLabel(y)}
                aria-pressed={on}
              >
                {y === 0 ? "NE" : y}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Learning area</h3>
        <div className="flex flex-col gap-0.5">
          {LEARNING_AREAS.map((a) => {
            const on = params.area === a.slug;
            return (
              <button key={a.slug} onClick={() => go({ area: on ? undefined : a.slug })} className={`${pill(on)} flex items-center gap-2`} aria-pressed={on}>
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: on ? "white" : a.color }} />
                {a.name}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Rating</h3>
        <div className="flex flex-col gap-0.5">
          {["4.5", "4", "3.5", "3"].map((r) => {
            const on = params.rating === r;
            return (
              <button key={r} onClick={() => go({ rating: on ? undefined : r })} className={`${pill(on)} flex items-center gap-2`} aria-pressed={on}>
                <span className="flex">
                  {[1, 2, 3, 4, 5].map((i) => {
                    const fill = Math.max(0, Math.min(1, Number(r) - (i - 1)));
                    return (
                      <span key={i} className="relative h-4 w-4">
                        <Star className={`absolute h-4 w-4 ${on ? "text-white/30" : "text-line"}`} fill="currentColor" strokeWidth={0} />
                        <span className="absolute inset-y-0 left-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
                          <Star className={`h-4 w-4 ${on ? "text-white" : "text-amber-500"}`} fill="currentColor" strokeWidth={0} />
                        </span>
                      </span>
                    );
                  })}
                </span>
                {r} & up
              </button>
            );
          })}
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          const code = new FormData(e.currentTarget).get("code")?.toString().trim().toUpperCase();
          go({ code: code || undefined });
        }}
      >
        <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted" htmlFor="code-filter">
          Te Mātaiaho code
        </label>
        <input id="code-filter" key={params.code ?? ""} name="code" defaultValue={params.code} placeholder="Enter a code…" className="input font-mono uppercase" />
      </form>

      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Resource type</h3>
        <div className="flex flex-wrap gap-1.5">
          {RESOURCE_TYPES.map((t) => {
            const on = params.type === t.slug;
            return (
              <button
                key={t.slug}
                onClick={() => go({ type: on ? undefined : t.slug })}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition ${on ? "border-fern bg-fern text-white" : "border-line bg-paper hover:border-fern/40 hover:text-fern"}`}
                aria-pressed={on}
              >
                {t.name}
              </button>
            );
          })}
        </div>
      </div>
    </aside>
  );
}

export function SortSelect({ params }: { params: SearchParams }) {
  const router = useRouter();
  const current = params.sort ?? (params.q ? "relevance" : "newest");
  return (
    <select
      value={current}
      onChange={(e) => {
        const qs = new URLSearchParams();
        for (const [k, v] of Object.entries({ ...params, sort: e.target.value, page: undefined })) if (v) qs.set(k, v);
        router.push(`/resources?${qs}`, { scroll: false });
      }}
      className="rounded-full border border-line bg-paper px-3 py-1.5 text-sm outline-none focus:border-fern"
      aria-label="Sort by"
    >
      {params.q && <option value="relevance">Best match</option>}
      <option value="newest">Newest</option>
      <option value="rating">Top rated</option>
      <option value="popular">Most loved</option>
      <option value="title">Title A–Z</option>
    </select>
  );
}
