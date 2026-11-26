import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { ArrowRight, Search, Sparkles, Download, Heart, Eye } from "lucide-react";
import { Koru } from "@/components/KiwiLogo";
import { GridSkeleton, ResourceGrid } from "@/components/ResourceCard";
import { LEARNING_AREAS, YEARS, yearLabel } from "@/lib/taxonomy";
import { getAreaCounts, getPopularTags, searchResources } from "@/lib/resources";
import { getCurrentUser } from "@/lib/session";

export default function Home() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-line bg-fern text-white">
        <Koru className="pointer-events-none absolute -right-10 -top-6 h-[420px] w-[420px] text-white/[0.06]" />
        <Koru className="pointer-events-none absolute -bottom-24 left-[8%] h-64 w-64 -scale-x-100 text-kiwifruit/10" />
        <div className="relative mx-auto max-w-7xl px-4 pb-16 pt-14 sm:px-6 sm:pb-20 sm:pt-20">
          <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/90 ring-1 ring-white/15">
            <Sparkles className="h-3.5 w-3.5 text-kiwifruit" /> Kia ora, kaiako — free while we grow
          </p>
          <h1 className="mt-5 max-w-3xl text-4xl font-bold leading-[1.05] sm:text-6xl">
            Classroom-ready resources for <span className="text-kiwifruit">Aotearoa</span>.
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-white/80">
            Short, printable 1–4 page worksheets, lesson plans and activities for every year level —
            New Entrants through Year 13.
          </p>

          <form action="/resources" className="mt-8 flex max-w-2xl flex-col gap-2 rounded-2xl bg-white p-2 shadow-2xl shadow-fern-dark/40 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" />
              <input
                name="q"
                placeholder="Try “fractions”, “Matariki” or “persuasive writing”"
                className="h-12 w-full rounded-xl bg-transparent pl-12 pr-3 text-ink outline-none placeholder:text-muted/70"
                aria-label="Search"
              />
            </div>
            <select name="year" className="h-12 rounded-xl border border-line bg-sand px-3 text-sm text-ink outline-none" aria-label="Year level" defaultValue="">
              <option value="">Any year</option>
              {YEARS.map((y) => (
                <option key={y} value={y}>{yearLabel(y)}</option>
              ))}
            </select>
            <button className="btn-primary h-12 rounded-xl px-6">Search</button>
          </form>

          <div className="mt-6 flex flex-wrap items-center gap-2 text-sm">
            <span className="text-white/60">Jump to:</span>
            {YEARS.map((y) => (
              <Link
                key={y}
                href={`/resources?year=${y}`}
                className="rounded-full bg-white/10 px-3 py-1 font-medium text-white/90 ring-1 ring-white/15 transition hover:bg-white hover:text-fern"
              >
                {yearLabel(y, true)}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="-mt-8 grid gap-4 sm:grid-cols-3">
          {[
            { icon: Eye, title: "Preview anything", text: "Flick through every page before you commit — no account needed." },
            { icon: Download, title: "Download free", text: "Sign in (free) to grab the clean, watermark-free PDF." },
            { icon: Heart, title: "Save favourites", text: "Build your own shortlist for next term's planning." },
          ].map(({ icon: Icon, title, text }) => (
            <div key={title} className="card relative flex gap-4 p-5 shadow-sm">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-fern-light text-fern">
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold">{title}</h3>
                <p className="mt-0.5 text-sm text-muted">{text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Learning areas */}
      <section className="mx-auto max-w-7xl px-4 pt-16 sm:px-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold sm:text-3xl">Browse by learning area</h2>
            <p className="mt-1 text-muted">Aligned to the New Zealand Curriculum.</p>
          </div>
        </div>
        <Suspense fallback={<AreaGrid counts={{}} />}>
          <AreaGridWithCounts />
        </Suspense>
      </section>

      {/* Latest */}
      <section className="mx-auto max-w-7xl px-4 pt-16 sm:px-6">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold sm:text-3xl">Fresh off the press</h2>
            <p className="mt-1 text-muted">The newest resources added to the kete.</p>
          </div>
          <Link href="/resources" className="hidden items-center gap-1 text-sm font-semibold text-fern hover:underline sm:flex">
            View all <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <Suspense fallback={<GridSkeleton count={8} />}>
          <Latest />
        </Suspense>
      </section>

      <Suspense fallback={null}>
        <PopularTags />
      </Suspense>
    </>
  );
}

function AreaGrid({ counts }: { counts: Record<string, number> }) {
  return (
    <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {LEARNING_AREAS.map((a) => (
        <Link
          key={a.slug}
          href={`/resources?area=${a.slug}`}
          className="card group relative overflow-hidden p-4 transition hover:-translate-y-0.5 hover:shadow-md"
        >
          <span className="absolute inset-x-0 top-0 h-1" style={{ background: a.color }} />
          <div className="font-semibold leading-tight group-hover:text-fern">{a.name}</div>
          <div className="mt-1 text-xs text-muted">
            {counts[a.slug] ? `${counts[a.slug]} resource${counts[a.slug] === 1 ? "" : "s"}` : " "}
          </div>
        </Link>
      ))}
    </div>
  );
}

async function AreaGridWithCounts() {
  await connection();
  const counts = await getAreaCounts();
  return <AreaGrid counts={counts} />;
}

async function Latest() {
  await connection();
  const user = await getCurrentUser();
  const { rows } = await searchResources({ sort: "newest" }, user?.id ?? null);
  if (!rows.length) {
    return (
      <div className="card flex flex-col items-center px-6 py-14 text-center">
        <p className="font-display text-xl font-semibold">The kete is empty… for now</p>
        <p className="mt-2 max-w-md text-sm text-muted">
          Resources will appear here as soon as they’re uploaded.
          {user?.isAdmin && " You’re an admin — add the first one!"}
        </p>
        {user?.isAdmin && (
          <Link href="/admin/new" className="btn-primary mt-5">Upload a resource</Link>
        )}
      </div>
    );
  }
  return <ResourceGrid resources={rows.slice(0, 8)} signedIn={!!user} />;
}

async function PopularTags() {
  await connection();
  const tags = await getPopularTags();
  if (!tags.length) return null;
  return (
    <section className="mx-auto max-w-7xl px-4 pt-16 sm:px-6">
      <h2 className="text-2xl font-bold sm:text-3xl">Popular topics</h2>
      <div className="mt-5 flex flex-wrap gap-2">
        {tags.map((t) => (
          <Link key={t.tag} href={`/resources?tag=${encodeURIComponent(t.tag)}`} className="chip px-4 py-1.5 text-sm">
            #{t.tag} <span className="text-muted">{t.n}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
