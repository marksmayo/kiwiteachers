import Link from "next/link";
import { SITE } from "@/lib/site";

const PAGES = [
  { href: "/terms", label: "Terms of use" },
  { href: "/privacy", label: "Privacy policy" },
  { href: "/copyright", label: "Copyright & takedown" },
  { href: "/guidelines", label: "Community guidelines" },
];

export function LegalPage({ title, intro, current, children }: { title: string; intro: string; current: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[220px_1fr]">
      <nav aria-label="Legal pages" className="lg:sticky lg:top-24 lg:self-start">
        <ul className="flex flex-wrap gap-2 lg:flex-col lg:gap-1">
          {PAGES.map((p) => (
            <li key={p.href}>
              <Link
                href={p.href}
                aria-current={current === p.href ? "page" : undefined}
                className={`block rounded-lg px-3 py-2 text-sm ${current === p.href ? "bg-fern text-white font-semibold" : "text-ink/75 hover:bg-fern-light hover:text-fern"}`}
              >
                {p.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <article className="legal max-w-3xl">
        <h1 className="text-4xl font-bold">{title}</h1>
        <p className="mt-2 text-sm text-muted">Last updated {SITE.legalUpdated}</p>
        <p className="mt-6 text-lg leading-relaxed text-ink/80">{intro}</p>
        <div className="mt-8 space-y-4 leading-relaxed text-ink/85 [&_a]:font-medium [&_a]:text-fern [&_a]:underline [&_h2]:mt-10 [&_h2]:text-2xl [&_h2]:font-bold [&_h3]:mt-6 [&_h3]:font-semibold [&_li]:ml-5 [&_ol]:list-decimal [&_ol]:space-y-1.5 [&_ul]:list-disc [&_ul]:space-y-1.5">
          {children}
        </div>
      </article>
    </div>
  );
}

export function Contact() {
  return <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a>;
}
