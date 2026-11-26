import Link from "next/link";
import { Suspense } from "react";
import { Search } from "lucide-react";
import { KiwiMark } from "./KiwiLogo";
import { UserMenu } from "./UserMenu";

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-line/80 bg-sand/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2.5">
          <KiwiMark className="h-9 w-9" />
          <span className="font-display text-lg font-bold tracking-tight">
            Kiwi<span className="text-fern">Teachers</span>
          </span>
        </Link>

        <nav className="ml-4 hidden items-center gap-1 text-sm font-medium md:flex">
          <Link href="/resources" className="rounded-full px-3 py-1.5 text-ink/80 hover:bg-fern-light hover:text-fern">
            Browse
          </Link>
          <Link href="/favourites" className="rounded-full px-3 py-1.5 text-ink/80 hover:bg-fern-light hover:text-fern">
            Favourites
          </Link>
          <Link href="/contribute" className="rounded-full px-3 py-1.5 text-ink/80 hover:bg-fern-light hover:text-fern">
            Contribute
          </Link>
        </nav>

        <form action="/resources" className="relative ml-auto hidden w-full max-w-xs sm:block">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input name="q" placeholder="Search resources…" className="input rounded-full py-2 pl-10" aria-label="Search resources" />
        </form>

        <div className="ml-auto flex items-center sm:ml-0">
          <Suspense fallback={<div className="h-9 w-20" />}>
            <UserMenu />
          </Suspense>
        </div>
      </div>
    </header>
  );
}
