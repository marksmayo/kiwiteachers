import Link from "next/link";
import { KiwiMark } from "./KiwiLogo";
import { LEARNING_AREAS } from "@/lib/taxonomy";

export function Footer() {
  return (
    <footer className="mt-24 border-t border-line bg-paper">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <div className="flex items-center gap-2.5">
            <KiwiMark className="h-8 w-8" />
            <span className="font-display text-lg font-bold">
              Kiwi<span className="text-fern">Teachers</span>
            </span>
          </div>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted">
            Short, print-ready resources made for Aotearoa classrooms. Free to download for signed-in
            kaiako. Ngā mihi for teaching our tamariki.
          </p>
        </div>
        <div>
          <h3 className="text-sm font-semibold">Learning areas</h3>
          <ul className="mt-3 grid gap-1.5 text-sm text-muted">
            {LEARNING_AREAS.slice(0, 6).map((a) => (
              <li key={a.slug}>
                <Link href={`/resources?area=${a.slug}`} className="hover:text-fern">
                  {a.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="text-sm font-semibold">Explore</h3>
          <ul className="mt-3 grid gap-1.5 text-sm text-muted">
            <li><Link href="/resources" className="hover:text-fern">All resources</Link></li>
            <li><Link href="/resources?sort=popular" className="hover:text-fern">Most loved</Link></li>
            <li><Link href="/favourites" className="hover:text-fern">My favourites</Link></li>
            <li><Link href="/contribute" className="hover:text-fern">Share a resource</Link></li>
            <li><Link href="/sign-up" className="hover:text-fern">Create a free account</Link></li>
            <li><Link href="/account" className="hover:text-fern">Account settings</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-line px-4 py-5 text-center text-xs text-muted">
        <nav className="mb-2 flex flex-wrap justify-center gap-x-4 gap-y-1" aria-label="Legal">
          <Link href="/terms" className="hover:text-fern">Terms of use</Link>
          <Link href="/privacy" className="hover:text-fern">Privacy policy</Link>
          <Link href="/copyright" className="hover:text-fern">Copyright &amp; takedown</Link>
          <Link href="/guidelines" className="hover:text-fern">Community guidelines</Link>
          <Link href="/account#delete" className="hover:text-fern">Delete my account</Link>
        </nav>
        Made with aroha in Aotearoa New Zealand
      </div>
    </footer>
  );
}
